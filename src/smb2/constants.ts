/**
 * SMB2 Constants
 */

// Commands
export const Command = {
  NEGOTIATE: 0x0000,
  SESSION_SETUP: 0x0001,
  TREE_CONNECT: 0x0003,
  CREATE: 0x0005,
  CLOSE: 0x0006,
  READ: 0x0008,
  QUERY_DIRECTORY: 0x000e,
} as const;

// Header size
export const HEADER_SIZE = 64;

// Protocol ID: 0xFE 'SMB'
export const PROTOCOL_ID = Buffer.from([0xfe, 0x53, 0x4d, 0x42]);

// Status codes
export const Status = {
  SUCCESS: 0x00000000,
  MORE_PROCESSING_REQUIRED: 0xc0000016,
  NO_MORE_FILES: 0x80000006,
  END_OF_FILE: 0xc0000011,
} as const;
