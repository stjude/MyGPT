import { Menu, MenuItemConstructorOptions, app, shell } from 'electron'

export function setupApplicationMenu(apiBaseUrl: string): void {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' as const } : { role: 'quit' as const }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    {
      label: 'Developer & APIs',
      submenu: [
        {
          label: 'Open Swagger UI (/api/docs/)',
          click: async () => {
            await shell.openExternal(`${apiBaseUrl}/api/docs/`)
          },
        },
        {
          label: 'Open OpenAPI 3.0 Schema (/api/schema/)',
          click: async () => {
            await shell.openExternal(`${apiBaseUrl}/api/schema/`)
          },
        },
        {
          label: 'Open ReDoc Documentation (/api/redoc/)',
          click: async () => {
            await shell.openExternal(`${apiBaseUrl}/api/redoc/`)
          },
        },
        { type: 'separator' as const },
        {
          label: 'Test Backend Health (/api/frontend_settings/)',
          click: async () => {
            await shell.openExternal(`${apiBaseUrl}/api/frontend_settings/`)
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'MyGPT GitHub Repository',
          click: async () => {
            await shell.openExternal('https://github.com/stjude/MyGPT')
          },
        },
        {
          label: 'Ollama Documentation',
          click: async () => {
            await shell.openExternal('https://ollama.ai')
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
