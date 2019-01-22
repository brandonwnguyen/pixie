// Code generated by protoc-gen-gogo. DO NOT EDIT.
// source: src/carnot/proto/types.proto

package carnotpb

import proto "github.com/gogo/protobuf/proto"
import fmt "fmt"
import math "math"

import strconv "strconv"

// Reference imports to suppress errors if they are not otherwise used.
var _ = proto.Marshal
var _ = fmt.Errorf
var _ = math.Inf

// This is a compile-time assertion to ensure that this generated file
// is compatible with the proto package it is being compiled against.
// A compilation error at this line likely means your copy of the
// proto package needs to be updated.
const _ = proto.GoGoProtoPackageIsVersion2 // please upgrade the proto package

type DataType int32

const (
	DATA_TYPE_UNKNOWN DataType = 0
	BOOLEAN           DataType = 1
	INT64             DataType = 2
	FLOAT64           DataType = 3
	STRING            DataType = 4
)

var DataType_name = map[int32]string{
	0: "DATA_TYPE_UNKNOWN",
	1: "BOOLEAN",
	2: "INT64",
	3: "FLOAT64",
	4: "STRING",
}
var DataType_value = map[string]int32{
	"DATA_TYPE_UNKNOWN": 0,
	"BOOLEAN":           1,
	"INT64":             2,
	"FLOAT64":           3,
	"STRING":            4,
}

func (DataType) EnumDescriptor() ([]byte, []int) {
	return fileDescriptor_types_bdd699cbf41a5e6c, []int{0}
}

func init() {
	proto.RegisterEnum("pl.carnot.carnotpb.DataType", DataType_name, DataType_value)
}
func (x DataType) String() string {
	s, ok := DataType_name[int32(x)]
	if ok {
		return s
	}
	return strconv.Itoa(int(x))
}

func init() { proto.RegisterFile("src/carnot/proto/types.proto", fileDescriptor_types_bdd699cbf41a5e6c) }

var fileDescriptor_types_bdd699cbf41a5e6c = []byte{
	// 199 bytes of a gzipped FileDescriptorProto
	0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0xff, 0xe2, 0x92, 0x29, 0x2e, 0x4a, 0xd6,
	0x4f, 0x4e, 0x2c, 0xca, 0xcb, 0x2f, 0xd1, 0x2f, 0x28, 0xca, 0x2f, 0xc9, 0xd7, 0x2f, 0xa9, 0x2c,
	0x48, 0x2d, 0xd6, 0x03, 0xb3, 0x85, 0x84, 0x0a, 0x72, 0xf4, 0x20, 0x92, 0x50, 0xaa, 0x20, 0x49,
	0x2b, 0x88, 0x8b, 0xc3, 0x25, 0xb1, 0x24, 0x31, 0xa4, 0xb2, 0x20, 0x55, 0x48, 0x94, 0x4b, 0xd0,
	0xc5, 0x31, 0xc4, 0x31, 0x3e, 0x24, 0x32, 0xc0, 0x35, 0x3e, 0xd4, 0xcf, 0xdb, 0xcf, 0x3f, 0xdc,
	0x4f, 0x80, 0x41, 0x88, 0x9b, 0x8b, 0xdd, 0xc9, 0xdf, 0xdf, 0xc7, 0xd5, 0xd1, 0x4f, 0x80, 0x51,
	0x88, 0x93, 0x8b, 0xd5, 0xd3, 0x2f, 0xc4, 0xcc, 0x44, 0x80, 0x09, 0x24, 0xee, 0xe6, 0xe3, 0xef,
	0x08, 0xe2, 0x30, 0x0b, 0x71, 0x71, 0xb1, 0x05, 0x87, 0x04, 0x79, 0xfa, 0xb9, 0x0b, 0xb0, 0x38,
	0x99, 0x5d, 0x78, 0x28, 0xc7, 0x70, 0xe3, 0xa1, 0x1c, 0xc3, 0x87, 0x87, 0x72, 0x8c, 0x0d, 0x8f,
	0xe4, 0x18, 0x57, 0x3c, 0x92, 0x63, 0x3c, 0xf1, 0x48, 0x8e, 0xf1, 0xc2, 0x23, 0x39, 0xc6, 0x07,
	0x8f, 0xe4, 0x18, 0x5f, 0x3c, 0x92, 0x63, 0xf8, 0xf0, 0x48, 0x8e, 0x71, 0xc2, 0x63, 0x39, 0x86,
	0x28, 0x0e, 0x98, 0x5b, 0x92, 0xd8, 0xc0, 0xce, 0x34, 0x06, 0x04, 0x00, 0x00, 0xff, 0xff, 0xdc,
	0x60, 0x4d, 0x17, 0xc6, 0x00, 0x00, 0x00,
}
