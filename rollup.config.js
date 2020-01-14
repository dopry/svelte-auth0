import { terser } from 'rollup-plugin-terser';
import commonjs from 'rollup-plugin-commonjs';
import pkg from './package.json';
import resolve from 'rollup-plugin-node-resolve';
import svelte from 'rollup-plugin-svelte';

const name = pkg.name
	.replace(/^(@\S+\/)?(svelte-)?(\S+)/, '$3')
	.replace(/^\w/, (m) => m.toUpperCase())
	.replace(/-\w/g, (m) => m[1].toUpperCase());

export default {
	input: 'src/components/components.module.js',
	output: [
		{ file: pkg.module,	format: 'es', sourcemap: true, name },
		{ file: pkg.main, format: 'umd', sourcemap: true, name }
	],
	plugins: [
		svelte(),
		resolve({
			browser: true,
			dedupe: (importee) =>
				importee === 'svelte' || importee.startsWith('svelte/'),
		}),
		commonjs({
			include: ['node_modules/**'],
		}),
		terser(),
	]
};


