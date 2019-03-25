#include <algorithm>
#include <atomic>
#include <chrono>
#include <functional>
#include <memory>
#include <string>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>

#include "absl/base/internal/spinlock.h"
#include "src/common/base/base.h"
#include "src/stirling/data_table.h"
#include "src/stirling/proto/collector_config.pb.h"
#include "src/stirling/pub_sub_manager.h"
#include "src/stirling/source_connector.h"
#include "src/stirling/source_registry.h"
#include "src/stirling/stirling.h"

namespace pl {
namespace stirling {

// TODO(oazizi/kgandhi): Is there a better place for this function?
stirlingpb::Subscribe SubscribeToAllInfoClasses(const stirlingpb::Publish& publish_proto) {
  stirlingpb::Subscribe subscribe_proto;

  for (int i = 0; i < publish_proto.published_info_classes_size(); ++i) {
    auto sub_info_class = subscribe_proto.add_subscribed_info_classes();
    sub_info_class->MergeFrom(publish_proto.published_info_classes(i));
    sub_info_class->set_subscribed(true);
  }
  return subscribe_proto;
}

class StirlingImpl final : public Stirling {
 public:
  StirlingImpl() = delete;
  explicit StirlingImpl(std::unique_ptr<SourceRegistry> registry);
  ~StirlingImpl();

  Status Init() override;
  void GetPublishProto(stirlingpb::Publish* publish_pb) override;
  Status SetSubscription(const stirlingpb::Subscribe& subscribe_proto) override;
  void RegisterCallback(PushDataCallback f) override { agent_callback_ = f; }
  std::unordered_map<uint64_t, std::string> TableIDToNameMap() override;
  void Run() override;
  Status RunAsThread() override;
  void Stop() override;
  void WaitForThreadJoin() override;

 private:
  /**
   * Create data source connectors from the registered sources.
   */
  Status CreateSourceConnectors();

  /**
   * Adds a source to Stirling, and updates all state accordingly.
   */
  Status AddSourceFromRegistry(const std::string& name,
                               SourceRegistry::RegistryElement registry_element);

  /**
   * Main run implementation.
   */
  void RunCore();

  /**
   * Helper function to figure out how much to sleep between polling iterations.
   */
  std::chrono::milliseconds TimeUntilNextTick();

  /**
   * Sleeps for the specified duration, as long as it is above some threshold.
   */
  void SleepForDuration(std::chrono::milliseconds sleep_duration);

  /**
   * Main thread used to spawn off RunThread().
   */
  std::thread run_thread_;

  /**
   * Whether thread should be running.
   */
  std::atomic<bool> run_enable_;

  /**
   * Vector of all Source Connectors.
   */
  std::vector<std::unique_ptr<SourceConnector>> sources_;

  /**
   * Vector of all Data Tables.
   */
  std::vector<std::unique_ptr<DataTable>> tables_;

  /**
   * Vector of all the InfoClassManagers.
   */
  InfoClassManagerVec info_class_mgrs_;
  /**
   * Spin lock to lock updates to info_class_mgrs_.
   *
   */
  absl::base_internal::SpinLock info_class_mgrs_lock_;

  /**
   * Pointer the config unit that handles sub/pub with agent.
   */
  std::unique_ptr<PubSubManager> config_;

  /**
   * @brief Pointer to data source registry
   *
   */
  std::unique_ptr<SourceRegistry> registry_;

  const std::chrono::milliseconds kMinSleepDuration{1};

  /**
   * Function to call to push data to the agent.
   * Function signature is:
   *   uint64_t table_id
   *   std::unique_ptr<ColumnWrapperRecordBatch> data
   */
  PushDataCallback agent_callback_;
};

StirlingImpl::StirlingImpl(std::unique_ptr<SourceRegistry> registry)
    : run_enable_(false),
      config_(std::make_unique<PubSubManager>()),
      registry_(std::move(registry)) {}

StirlingImpl::~StirlingImpl() {
  Stop();
  WaitForThreadJoin();
}

Status StirlingImpl::Init() {
  PL_RETURN_IF_ERROR(CreateSourceConnectors());
  return Status::OK();
}

Status StirlingImpl::CreateSourceConnectors() {
  if (!registry_) {
    return error::NotFound("Source registry doesn't exist");
  }
  auto sources = registry_->sources();
  for (const auto& [name, registry_element] : sources) {
    Status s = AddSourceFromRegistry(name, registry_element);

    if (!s.ok()) {
      LOG(WARNING) << absl::StrFormat("Source Connector (registry name=%s) not instantiated", name);
      LOG(WARNING) << s.status().ToString();
    }
  }
  return Status::OK();
}

std::unordered_map<uint64_t, std::string> StirlingImpl::TableIDToNameMap() {
  std::unordered_map<uint64_t, std::string> map;

  for (auto& mgr : info_class_mgrs_) {
    map.insert({mgr->id(), mgr->name()});
  }

  return map;
}

Status StirlingImpl::AddSourceFromRegistry(const std::string& name,
                                           SourceRegistry::RegistryElement registry_element) {
  // Step 1: Create and init the source.
  auto source = registry_element.create_source_fn(name);
  PL_RETURN_IF_ERROR(source->Init());

  // Step 2: Create the info class manager.
  auto mgr = std::make_unique<InfoClassManager>(name);
  auto mgr_ptr = mgr.get();
  mgr->SetSourceConnector(source.get());

  // Step 3: Setup the manager.
  PL_CHECK_OK(mgr_ptr->PopulateSchemaFromSource());
  mgr_ptr->SetSamplingPeriod(registry_element.sampling_period);
  mgr_ptr->SetPushPeriod(registry_element.push_period);

  // Step 4: Keep pointers to all the objects
  sources_.push_back(std::move(source));
  info_class_mgrs_.push_back(std::move(mgr));

  return Status::OK();
}

void StirlingImpl::GetPublishProto(stirlingpb::Publish* publish_pb) {
  config_->GeneratePublishProto(publish_pb, info_class_mgrs_);
}

Status StirlingImpl::SetSubscription(const stirlingpb::Subscribe& subscribe_proto) {
  // Acquire lock to update info_class_mgrs_.
  absl::base_internal::SpinLockHolder lock(&info_class_mgrs_lock_);

  // Last append before clearing tables from old subscriptions.
  for (const auto& mgr : info_class_mgrs_) {
    if (mgr->subscribed()) {
      PL_CHECK_OK(mgr->PushData(agent_callback_));
    }
  }
  tables_.clear();

  // Update schemas based on the subscribe_proto.
  PL_CHECK_OK(config_->UpdateSchemaFromSubscribe(subscribe_proto, info_class_mgrs_));

  // Generate the tables required based on subscribed Info Classes.
  for (const auto& mgr : info_class_mgrs_) {
    if (mgr->subscribed()) {
      auto data_table = std::make_unique<DataTable>(mgr->Schema());
      mgr->SetDataTable(data_table.get());
      // TODO(kgandhi): PL-426
      // Set sampling frequency based on input from Vizer.
      tables_.push_back(std::move(data_table));
    }
  }

  return Status::OK();
}

// Main call to start the data collection.
Status StirlingImpl::RunAsThread() {
  bool prev_run_enable_ = run_enable_.exchange(true);

  if (prev_run_enable_) {
    return error::AlreadyExists("A Stirling thread is already running.");
  }

  run_thread_ = std::thread(&StirlingImpl::RunCore, this);

  return Status::OK();
}

void StirlingImpl::WaitForThreadJoin() {
  if (run_thread_.joinable()) {
    run_thread_.join();
  }
}

void StirlingImpl::Run() {
  // Make sure multiple instances of Run() are not active,
  // which would be possible if the caller created multiple threads.
  bool prev_run_enable_ = run_enable_.exchange(true);

  if (prev_run_enable_) {
    LOG(ERROR) << "A Stirling thread is already running.";
    return;
  }

  RunCore();
}

// Main Data Collector loop.
// Poll on Data Source Through connectors, when appropriate, then go to sleep.
// Must run as a thread, so only call from Run() as a thread.
void StirlingImpl::RunCore() {
  while (run_enable_) {
    auto sleep_duration = std::chrono::milliseconds::zero();

    {
      // Acquire spin lock to go through one iteration of sampling and pushing data.
      // Needed to avoid race with main thread update info_class_mgrs_ on new subscription.
      absl::base_internal::SpinLockHolder lock(&info_class_mgrs_lock_);

      // Run through every InfoClass being managed.
      for (const auto& mgr : info_class_mgrs_) {
        if (mgr->subscribed()) {
          // Phase 1: Probe each source for its data.
          if (mgr->SamplingRequired()) {
            PL_CHECK_OK(mgr->SampleData());
          }

          // Phase 2: Push Data upstream.
          if (mgr->PushRequired()) {
            PL_CHECK_OK(mgr->PushData(agent_callback_));
          }

          // Optional: Update sampling periods if we are dropping data.
        }
      }

      // Figure out how long to sleep.
      sleep_duration = TimeUntilNextTick();
    }

    SleepForDuration(sleep_duration);
  }
}

void StirlingImpl::Stop() { run_enable_ = false; }

// Helper function: Figure out when to wake up next.
std::chrono::milliseconds StirlingImpl::TimeUntilNextTick() {
  // The amount to sleep depends on when the earliest Source needs to be sampled again.
  // Do this to avoid burning CPU cycles unnecessarily

  auto now = std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::high_resolution_clock::now().time_since_epoch());

  auto wakeup_time = std::chrono::milliseconds::max();

  for (const auto& mgr : info_class_mgrs_) {
    // TODO(oazizi): Make implementation of NextPushTime/NextSamplingTime low cost.
    wakeup_time = std::min(wakeup_time, mgr->NextPushTime());
    wakeup_time = std::min(wakeup_time, mgr->NextSamplingTime());
  }

  return wakeup_time - now;
}

void StirlingImpl::SleepForDuration(std::chrono::milliseconds sleep_duration) {
  if (sleep_duration > kMinSleepDuration) {
    std::this_thread::sleep_for(sleep_duration);
  }
}

std::unique_ptr<Stirling> Stirling::Create() {
  auto registry = std::make_unique<SourceRegistry>();
  RegisterAllSources(registry.get());
  return Create(std::move(registry));
}

std::unique_ptr<Stirling> Stirling::Create(std::unique_ptr<SourceRegistry> registry) {
  std::unique_ptr<Stirling> stirling(new StirlingImpl(std::move(registry)));
  return stirling;
}

}  // namespace stirling
}  // namespace pl
