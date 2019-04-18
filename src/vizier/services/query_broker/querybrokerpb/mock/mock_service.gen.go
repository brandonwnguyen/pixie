// Code generated by MockGen. DO NOT EDIT.
// Source: pixielabs.ai/pixielabs/src/vizier/services/query_broker/querybrokerpb (interfaces: QueryBrokerServiceClient)

// Package mock_querybrokerpb is a generated GoMock package.
package mock_querybrokerpb

import (
	context "context"
	gomock "github.com/golang/mock/gomock"
	grpc "google.golang.org/grpc"
	querybrokerpb "pixielabs.ai/pixielabs/src/vizier/services/query_broker/querybrokerpb"
	reflect "reflect"
)

// MockQueryBrokerServiceClient is a mock of QueryBrokerServiceClient interface
type MockQueryBrokerServiceClient struct {
	ctrl     *gomock.Controller
	recorder *MockQueryBrokerServiceClientMockRecorder
}

// MockQueryBrokerServiceClientMockRecorder is the mock recorder for MockQueryBrokerServiceClient
type MockQueryBrokerServiceClientMockRecorder struct {
	mock *MockQueryBrokerServiceClient
}

// NewMockQueryBrokerServiceClient creates a new mock instance
func NewMockQueryBrokerServiceClient(ctrl *gomock.Controller) *MockQueryBrokerServiceClient {
	mock := &MockQueryBrokerServiceClient{ctrl: ctrl}
	mock.recorder = &MockQueryBrokerServiceClientMockRecorder{mock}
	return mock
}

// EXPECT returns an object that allows the caller to indicate expected use
func (m *MockQueryBrokerServiceClient) EXPECT() *MockQueryBrokerServiceClientMockRecorder {
	return m.recorder
}

// ExecuteQuery mocks base method
func (m *MockQueryBrokerServiceClient) ExecuteQuery(arg0 context.Context, arg1 *querybrokerpb.QueryRequest, arg2 ...grpc.CallOption) (*querybrokerpb.VizierQueryResponse, error) {
	varargs := []interface{}{arg0, arg1}
	for _, a := range arg2 {
		varargs = append(varargs, a)
	}
	ret := m.ctrl.Call(m, "ExecuteQuery", varargs...)
	ret0, _ := ret[0].(*querybrokerpb.VizierQueryResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// ExecuteQuery indicates an expected call of ExecuteQuery
func (mr *MockQueryBrokerServiceClientMockRecorder) ExecuteQuery(arg0, arg1 interface{}, arg2 ...interface{}) *gomock.Call {
	varargs := append([]interface{}{arg0, arg1}, arg2...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ExecuteQuery", reflect.TypeOf((*MockQueryBrokerServiceClient)(nil).ExecuteQuery), varargs...)
}

// GetAgentInfo mocks base method
func (m *MockQueryBrokerServiceClient) GetAgentInfo(arg0 context.Context, arg1 *querybrokerpb.AgentInfoRequest, arg2 ...grpc.CallOption) (*querybrokerpb.AgentInfoResponse, error) {
	varargs := []interface{}{arg0, arg1}
	for _, a := range arg2 {
		varargs = append(varargs, a)
	}
	ret := m.ctrl.Call(m, "GetAgentInfo", varargs...)
	ret0, _ := ret[0].(*querybrokerpb.AgentInfoResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetAgentInfo indicates an expected call of GetAgentInfo
func (mr *MockQueryBrokerServiceClientMockRecorder) GetAgentInfo(arg0, arg1 interface{}, arg2 ...interface{}) *gomock.Call {
	varargs := append([]interface{}{arg0, arg1}, arg2...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetAgentInfo", reflect.TypeOf((*MockQueryBrokerServiceClient)(nil).GetAgentInfo), varargs...)
}

// GetSchemas mocks base method
func (m *MockQueryBrokerServiceClient) GetSchemas(arg0 context.Context, arg1 *querybrokerpb.SchemaRequest, arg2 ...grpc.CallOption) (*querybrokerpb.SchemaResponse, error) {
	varargs := []interface{}{arg0, arg1}
	for _, a := range arg2 {
		varargs = append(varargs, a)
	}
	ret := m.ctrl.Call(m, "GetSchemas", varargs...)
	ret0, _ := ret[0].(*querybrokerpb.SchemaResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetSchemas indicates an expected call of GetSchemas
func (mr *MockQueryBrokerServiceClientMockRecorder) GetSchemas(arg0, arg1 interface{}, arg2 ...interface{}) *gomock.Call {
	varargs := append([]interface{}{arg0, arg1}, arg2...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetSchemas", reflect.TypeOf((*MockQueryBrokerServiceClient)(nil).GetSchemas), varargs...)
}
