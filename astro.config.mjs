// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Site config. Update `site` to the eventual custom domain once it
// exists; today GitHub Pages serves from tombee.github.io/vibesmith-docs/.
const SITE_URL = 'https://tombee.github.io';
const BASE = '/vibesmith-docs';

export default defineConfig({
	site: SITE_URL,
	base: BASE,
	integrations: [
		starlight({
			title: 'Vibesmith',
			description:
				'Public docs for the Vibesmith framework — guides, cookbook, anti-patterns, and reference for building AI-augmented WebGL games.',
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/tombee/vibesmith-docs',
				},
			],
			sidebar: [
				{
					label: 'Getting started',
					items: [
						{ label: 'Introduction', slug: 'index' },
						{ label: 'Quick start', slug: 'getting-started/quick-start' },
					],
				},
				{
					label: 'Cookbook',
					items: [{ autogenerate: { directory: 'cookbook' } }],
				},
				{
					label: 'Anti-patterns',
					items: [{ label: 'R3F anti-patterns', slug: 'anti-patterns' }],
				},
				{
					label: 'Reference',
					items: [{ autogenerate: { directory: 'reference' } }],
				},
				{
					label: 'For agents',
					items: [{ label: 'Agent context', slug: 'agents' }],
				},
			],
		}),
	],
});
