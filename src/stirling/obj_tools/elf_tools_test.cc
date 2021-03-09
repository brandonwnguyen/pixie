#include "src/stirling/obj_tools/elf_tools.h"

#include "src/common/exec/exec.h"
#include "src/common/testing/test_environment.h"
#include "src/common/testing/testing.h"
#include "src/stirling/obj_tools/testdata/dummy_exe_fixture.h"

namespace pl {
namespace stirling {
namespace obj_tools {

const DummyExeFixture kDummyExeFixture;

using ::pl::stirling::obj_tools::ElfReader;
using ::pl::stirling::obj_tools::SymbolMatchType;
using ::testing::ElementsAre;
using ::testing::Field;
using ::testing::IsEmpty;
using ::testing::Pair;
using ::testing::SizeIs;
using ::testing::UnorderedElementsAre;

TEST(ElfReaderTest, NonExistentPath) {
  auto s = pl::stirling::obj_tools::ElfReader::Create("/bogus");
  ASSERT_NOT_OK(s);
}

auto SymbolNameIs(const std::string& n) { return Field(&ElfReader::SymbolInfo::name, n); }

TEST(ElfReaderTest, ListSymbolsAnyMatch) {
  ASSERT_OK_AND_ASSIGN(std::unique_ptr<ElfReader> elf_reader,
                       ElfReader::Create(kDummyExeFixture.Path()));

  EXPECT_OK_AND_THAT(elf_reader->ListFuncSymbols("CanYouFindThis", SymbolMatchType::kSubstr),
                     ElementsAre(SymbolNameIs("CanYouFindThis")));
  EXPECT_OK_AND_THAT(elf_reader->ListFuncSymbols("YouFind", SymbolMatchType::kSubstr),
                     ElementsAre(SymbolNameIs("CanYouFindThis")));
  EXPECT_OK_AND_THAT(elf_reader->ListFuncSymbols("FindThis", SymbolMatchType::kSubstr),
                     ElementsAre(SymbolNameIs("CanYouFindThis")));
}

TEST(ElfReaderTest, ListSymbolsExactMatch) {
  ASSERT_OK_AND_ASSIGN(std::unique_ptr<ElfReader> elf_reader,
                       ElfReader::Create(kDummyExeFixture.Path()));

  EXPECT_OK_AND_THAT(elf_reader->ListFuncSymbols("CanYouFindThis", SymbolMatchType::kExact),
                     ElementsAre(SymbolNameIs("CanYouFindThis")));
  EXPECT_OK_AND_THAT(elf_reader->ListFuncSymbols("YouFind", SymbolMatchType::kExact), IsEmpty());
  EXPECT_OK_AND_THAT(elf_reader->ListFuncSymbols("FindThis", SymbolMatchType::kExact), IsEmpty());
}

TEST(ElfReaderTest, ListSymbolsPrefixMatch) {
  ASSERT_OK_AND_ASSIGN(std::unique_ptr<ElfReader> elf_reader,
                       ElfReader::Create(kDummyExeFixture.Path()));

  EXPECT_OK_AND_THAT(elf_reader->ListFuncSymbols("CanYouFindThis", SymbolMatchType::kPrefix),
                     ElementsAre(SymbolNameIs("CanYouFindThis")));
  EXPECT_OK_AND_THAT(elf_reader->ListFuncSymbols("YouFind", SymbolMatchType::kPrefix), IsEmpty());
  EXPECT_OK_AND_THAT(elf_reader->ListFuncSymbols("CanYou", SymbolMatchType::kPrefix),
                     ElementsAre(SymbolNameIs("CanYouFindThis")));
}

TEST(ElfReaderTest, ListSymbolsSuffixMatch) {
  ASSERT_OK_AND_ASSIGN(std::unique_ptr<ElfReader> elf_reader,
                       ElfReader::Create(kDummyExeFixture.Path()));

  EXPECT_OK_AND_THAT(elf_reader->ListFuncSymbols("CanYouFindThis", SymbolMatchType::kSuffix),
                     ElementsAre(SymbolNameIs("CanYouFindThis")));
  EXPECT_OK_AND_THAT(elf_reader->ListFuncSymbols("YouFind", SymbolMatchType::kSuffix), IsEmpty());
  EXPECT_OK_AND_THAT(elf_reader->ListFuncSymbols("FindThis", SymbolMatchType::kSuffix),
                     ElementsAre(SymbolNameIs("CanYouFindThis")));
}

#ifdef __linux__
TEST(ElfReaderTest, SymbolAddress) {
  const std::string path = kDummyExeFixture.Path().string();
  const std::string_view symbol = "CanYouFindThis";

  // Extract the address from nm as the gold standard.
  int64_t expected_symbol_addr = -1;
  std::string nm_out = pl::Exec(absl::StrCat("nm ", path)).ValueOrDie();
  std::vector<absl::string_view> nm_out_lines = absl::StrSplit(nm_out, '\n');
  for (auto& line : nm_out_lines) {
    if (line.find(symbol) != std::string::npos) {
      std::vector<absl::string_view> line_split = absl::StrSplit(line, ' ');
      ASSERT_FALSE(line_split.empty());
      expected_symbol_addr = std::stol(std::string(line_split[0]), nullptr, 16);
      break;
    }
  }
  ASSERT_NE(expected_symbol_addr, -1);

  // Actual tests of SymbolAddress begins here.

  ASSERT_OK_AND_ASSIGN(std::unique_ptr<ElfReader> elf_reader, ElfReader::Create(path));

  {
    std::optional<int64_t> addr = elf_reader->SymbolAddress(symbol);
    ASSERT_TRUE(addr.has_value());
    EXPECT_EQ(addr, expected_symbol_addr);
  }

  {
    std::optional<int64_t> addr = elf_reader->SymbolAddress("bogus");
    ASSERT_FALSE(addr.has_value());
  }
}
#endif

TEST(ElfReaderTest, ExternalDebugSymbolsBuildID) {
  const std::string stripped_bin =
      pl::testing::TestFilePath("src/stirling/obj_tools/testdata/stripped_dummy_exe");
  const std::string debug_dir =
      pl::testing::TestFilePath("src/stirling/obj_tools/testdata/usr/lib/debug");

  ASSERT_OK_AND_ASSIGN(std::unique_ptr<ElfReader> elf_reader,
                       ElfReader::Create(stripped_bin, debug_dir));

  EXPECT_OK_AND_THAT(elf_reader->ListFuncSymbols("CanYouFindThis", SymbolMatchType::kExact),
                     ElementsAre(SymbolNameIs("CanYouFindThis")));
}

TEST(ElfReaderTest, ExternalDebugSymbolsDebugLink) {
  const std::string stripped_bin =
      pl::testing::BazelBinTestFilePath("src/stirling/obj_tools/testdata/dummy_exe_debuglink");
  const std::string debug_dir =
      pl::testing::TestFilePath("src/stirling/obj_tools/testdata/usr/lib/debug2");

  ASSERT_OK_AND_ASSIGN(std::unique_ptr<ElfReader> elf_reader,
                       ElfReader::Create(stripped_bin, debug_dir));

  EXPECT_OK_AND_THAT(elf_reader->ListFuncSymbols("CanYouFindThis", SymbolMatchType::kExact),
                     ElementsAre(SymbolNameIs("CanYouFindThis")));
}

TEST(ElfReaderTest, FuncByteCode) {
  {
    const std::string path =
        pl::testing::TestFilePath("src/stirling/obj_tools/testdata/prebuilt_dummy_exe");
    ASSERT_OK_AND_ASSIGN(std::unique_ptr<ElfReader> elf_reader, ElfReader::Create(path));
    ASSERT_OK_AND_ASSIGN(const std::vector<ElfReader::SymbolInfo> symbol_infos,
                         elf_reader->ListFuncSymbols("CanYouFindThis", SymbolMatchType::kExact));
    ASSERT_THAT(symbol_infos, SizeIs(1));
    const auto& symbol_info = symbol_infos.front();
    // The byte code can be examined with:
    // objdump -d src/stirling/obj_tools/testdata/prebuilt_dummy_exe | grep CanYouFindThis -A 20
    // 0x201101 is the address of the 'c3' (retq) opcode.
    ASSERT_OK_AND_THAT(elf_reader->FuncRetInstAddrs(symbol_info), ElementsAre(0x4011e1));
  }
  {
    const std::string stripped_bin =
        pl::testing::TestFilePath("src/stirling/obj_tools/testdata/stripped_dummy_exe");
    const std::string debug_dir =
        pl::testing::TestFilePath("src/stirling/obj_tools/testdata/usr/lib/debug");
    ASSERT_OK_AND_ASSIGN(std::unique_ptr<ElfReader> elf_reader,
                         ElfReader::Create(stripped_bin, debug_dir));
    ASSERT_OK_AND_ASSIGN(const std::vector<ElfReader::SymbolInfo> symbol_infos,
                         elf_reader->ListFuncSymbols("CanYouFindThis", SymbolMatchType::kExact));
    ASSERT_THAT(symbol_infos, SizeIs(1));
    const auto& symbol_info = symbol_infos.front();
    ASSERT_OK_AND_THAT(elf_reader->FuncRetInstAddrs(symbol_info), ElementsAre(0x201101));
  }
}

TEST(ElfGolangItableTest, ExtractInterfaceTypes) {
  const std::string kPath = pl::testing::BazelBinTestFilePath(
      "src/stirling/obj_tools/testdata/dummy_go_binary_/dummy_go_binary");

  ASSERT_OK_AND_ASSIGN(std::unique_ptr<ElfReader> elf_reader, ElfReader::Create(kPath));
  ASSERT_OK_AND_ASSIGN(const auto interfaces, ExtractGolangInterfaces(elf_reader.get()));

  // Check for `bazel coverage` so we can bypass the final checks.
  // Note that we still get accurate coverage metrics, because this only skips the final check.
  // Ideally, we'd get bazel to deterministically build dummy_go_binary,
  // but it's not easy to tell bazel to use a different config for just one target.
#ifdef PL_COVERAGE
  LOG(INFO) << "Whoa...`bazel coverage` is messaging with dummy_go_binary. Shame on you bazel. "
               "Ending this test early.";
  return;
#else

  EXPECT_THAT(
      interfaces,
      UnorderedElementsAre(
          Pair("error",
               UnorderedElementsAre(
                   Field(&IntfImplTypeInfo::type_name, "main.IntStruct"),
                   Field(&IntfImplTypeInfo::type_name, "*errors.errorString"),
                   Field(&IntfImplTypeInfo::type_name, "*io/fs.PathError"),
                   Field(&IntfImplTypeInfo::type_name, "*internal/poll.DeadlineExceededError"),
                   Field(&IntfImplTypeInfo::type_name, "runtime.errorString"),
                   Field(&IntfImplTypeInfo::type_name, "syscall.Errno"))),
          Pair("sort.Interface", UnorderedElementsAre(Field(&IntfImplTypeInfo::type_name,
                                                            "*internal/fmtsort.SortedMap"))),
          Pair("math/rand.Source", UnorderedElementsAre(Field(&IntfImplTypeInfo::type_name,
                                                              "*math/rand.lockedSource"))),
          Pair("io.Writer", UnorderedElementsAre(Field(&IntfImplTypeInfo::type_name, "*os.File"))),
          Pair("internal/reflectlite.Type",
               UnorderedElementsAre(
                   Field(&IntfImplTypeInfo::type_name, "*internal/reflectlite.rtype"))),
          Pair("reflect.Type",
               UnorderedElementsAre(Field(&IntfImplTypeInfo::type_name, "*reflect.rtype"))),
          Pair("fmt.State", UnorderedElementsAre(Field(&IntfImplTypeInfo::type_name, "*fmt.pp")))));
#endif
}

}  // namespace obj_tools
}  // namespace stirling
}  // namespace pl
