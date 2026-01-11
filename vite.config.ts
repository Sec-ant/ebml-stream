import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

export default defineConfig({
	build: {
		minify: false,
		lib: {
			entry: {
				index: "src/index.ts",
			},
			formats: ["es"],
			fileName: (_, entryName) => `${entryName}.js`,
		},
	},
	plugins: [
		dts({
			entryRoot: "src",
			exclude: ["test", "src/**/*.spec.ts"],
		}),
	],
});
