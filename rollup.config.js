import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import nativePlugin from 'rollup-plugin-natives';

export default {
  input: 'src/index.js',
  output: {
    file: 'build/rollup.cjs',
    format: 'cjs'
  },
  external: [
    'better_sqlite3.node'
  ],
  plugins: [ nativePlugin({
      // Where we want to physically put the extracted .node files
      copyTo: 'build',

      // Path to the same folder, relative to the output bundle js
      destDir: './',

      // Use `dlopen` instead of `require`/`import`. 
      // This must be set to true if using a different file extension that '.node'
      dlopen: false,

      // Generate sourcemap
      sourcemap: true
    }),
    json(), commonjs({
      ignoreDynamicRequires: true
    }), resolve()
  ]
};