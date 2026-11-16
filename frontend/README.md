# MyGPT Frontend

This project uses [Vite](https://vite.dev/) with React and TypeScript.

## Available Scripts

In the project directory, you can run:

### `npm start` / `npm run dev`

Runs the app in development mode with hot module reloading.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `npm test`

Runs the test suite once via [Vitest](https://vitest.dev/). Use `npm run test:watch` for interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder.\
Use `npm run build:prod` / `npm run build:azure` to build with the `.env.production` / `.env.azure` mode files.

### `npm run preview`

Serves the production build locally for a final check before deployment.

## Docker image publishing

Both frontend image workflows build AMD64 on `ubuntu-latest` and ARM64 on
`ubuntu-24.04-arm`, without QEMU emulation. Once both builds succeed, a manifest
job publishes the multi-architecture `latest` tag. The release workflow also
publishes the release version without its leading `v`. Intermediate image tags
include the workflow run ID, attempt, and architecture so the manifest only
combines images from the same run.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
