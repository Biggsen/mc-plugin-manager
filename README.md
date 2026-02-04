# MC Plugin Manager

Exploration Server Config Tool for Minecraft Plugin Configuration Management

## Development

### Setup

```bash
npm install
```

### Run Development Server

In one terminal:
```bash
npm run dev
```

In another terminal:
```bash
npm run electron:dev
```

### Build

```bash
npm run build:electron
```

This will compile TypeScript files and prepare the app for Electron.

## UI

The frontend uses [Mantine](https://mantine.dev/) v8 for consistent, accessible components and theming. Global styles and theme are configured in `src/main.tsx`.

## Project Structure

- `electron/` - Electron main process code
- `src/` - React renderer application (Mantine UI)
- `spec/` - Specification documentation
- `reference/` - Reference plugin config files

## Milestones

- **M1** (Current): GUI skeleton + Server storage ✅
- **M2**: Region import + onboarding editing
- **M3**: AA generator + merge
- **M4**: CE generator + merge
- **M5**: Diff gate + build reports
