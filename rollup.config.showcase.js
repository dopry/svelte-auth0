import replace from '@rollup/plugin-replace';
import pkg from './package.json';
import commonjs from 'rollup-plugin-commonjs';
import livereload from 'rollup-plugin-livereload';
import resolve from 'rollup-plugin-node-resolve';
import svelte from 'rollup-plugin-svelte';

const production = !process.env.ROLLUP_WATCH;

export default {
	input: 'src/main.js',
	output:  { sourcemap: true,	format: 'iife',	name: 'app', file: 'public/bundle.js'  },
	plugins: [
		replace({
			'process.env.AUTH0_DEFAULT_DOMAIN': 'dev-hvw40i79.auth0.com',
			'process.env.AUTH0_DEFAULT_CLIENT_ID': 'aOijZt2ug6Ovgzp0HXdF23B6zxwA6PaP',
			'process.env.AUTH0_DEFAULT_CALLBACK_URL': production ? 'https://darrelopry.com/svelte-auth0' : '',
			'pkg.version': pkg.version
		}),
		svelte({ dev: true }),
		resolve({
			browser: true,
			dedupe: (importee) =>
				importee === 'svelte' || importee.startsWith('svelte/'),
		}),
		commonjs({
			include: ['node_modules/**'],
		}),

		// In dev mode, call `npm run start` once
		// the bundle has been generated
		!production && serve(),

		// Watch the `public` directory and refresh the
		// browser on changes when not in production
		!production && livereload('public'),
	],
	watch: {
		clearScreen: false,
	},
};

function serve() {
	let started = false;

	return {
		writeBundle() {
			if (!started) {
				started = true;

				require('child_process').spawn(
					'npm',
					['run', 'start', '--', '--dev'],
					{
						stdio: ['ignore', 'inherit', 'inherit'],
						shell: true,
					}
				);
			}
		},
	};
}
