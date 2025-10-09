# maki-smb

A lightweight SMB2 client for Node.js with NTLM authentication.

## Features

- SMB2 protocol (2.0.2, 2.1)
- NTLM authentication (v1/v2)
- Directory listing with pagination
- File reading with chunk support
- TypeScript support

## Requirements

- Node.js >= 18

## Installation

```bash
npm install
```

## Usage

### Basic

```typescript
import { SMBClient } from "maki-smb";

const client = new SMBClient({
  host: "192.168.1.100",
  port: 445,
  share: "shared",
  username: "user",
  password: "password",
});

await client.connect();

// List directory
const entries = await client.listDirectory();
for (const entry of entries) {
  console.log(entry.fileName, entry.isDirectory ? "[DIR]" : entry.fileSize);
}

// Read file
const content = await client.readFile("document.txt");
console.log(content.toString());

client.close();
```

### DirectoryReader

For large directories with batch reading:

```typescript
const reader = new DirectoryReader(client, { batchSize: 50 });
await reader.open("path/to/dir");

while (reader.hasMore()) {
  const batch = await reader.read();
  // process batch...
}

await reader.close();
```

| Option      | Default | Description      |
| ----------- | ------- | ---------------- |
| `batchSize` | `100`   | Entries per read |

### FileReader

For large files with chunk reading:

```typescript
const reader = new FileReader(client, { chunkSize: 64 * 1024 });
await reader.open("path/to/file");

while (reader.hasMore()) {
  const chunk = await reader.read();
  // process chunk...
}

await reader.close();
```

| Option      | Default | Description    |
| ----------- | ------- | -------------- |
| `chunkSize` | `65536` | Bytes per read |

**Methods:** `open`, `read`, `readAll`, `readBytes`, `hasMore`, `getSize`, `getOffset`, `seek`, `close`

## API

### DirectoryEntry

```typescript
interface DirectoryEntry {
  fileName: string;
  isDirectory: boolean;
  fileSize: bigint;
  creationTime: Date;
  lastWriteTime: Date;
}
```

## Development

```bash
# Start Samba server
docker-compose up -d

# Run tests
npm test
```

## License

MIT
