# Dynamic Character Controller
## https://youtu.be/ipW-DUyPYlk
[![Dynamic Character Controller With Three.js](https://user-images.githubusercontent.com/64514807/235347853-9411d7d7-1508-42a7-82aa-232650b13ee7.png)](https://youtu.be/ipW-DUyPYlk)

## Installation

Clone this repo and npm install.

```bash
npm i
```

## Usage

### Development server

```bash
npm start
```

You can view the development server at `localhost:8080`.

### Compiling Rust
```bash
npm run compile
```

### Production build

```bash
npm run build
```

> Note: Install [http-server](https://www.npmjs.com/package/http-server) globally to deploy a simple server.

```bash
npm i -g http-server
```

You can view the deploy by creating a server in `dist`.

```bash
cd dist && http-server
```

## Features

- [Three](https://threejs.org)
- [Webpack](https://webpack.js.org/)
- [Babel](https://babeljs.io/)
- [Sass](https://sass-lang.com/)
- [PostCSS](https://postcss.org/)
- [Gsap](https://greensock.com/gsap/)

## License

This project is open source and available under the [MIT License](LICENSE).
