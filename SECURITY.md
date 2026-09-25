# Security

Garment Studio can process local files, launch external/native backends and eventually control Blender or other desktop software. Treat input and backend boundaries as security-sensitive.

Do not file exploitable security issues publicly when they would expose users to immediate risk. Until a dedicated security mailbox is published, contact the project maintainers privately before disclosure.

Areas requiring particular care:

- imported DXF/JSON/3D files
- archive/factory-package extraction
- native solver subprocesses
- Blender Python execution
- external backend URLs/WebSockets
- model/checkpoint downloads
- agent/automation command execution
