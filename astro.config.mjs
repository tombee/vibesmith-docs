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
			title: 'vibesmith',
			description:
				'Public docs for the vibesmith framework — guides, cookbook, anti-patterns, and reference for building AI-augmented WebGL games.',
			// vibesmith brand tokens + Space Grotesk / JetBrains Mono /
			// system-ui via the theme CSS file. Source of truth for the
			// tokens themselves is `apps/vibesmith-app/index.html` in
			// the framework repo; this file mirrors them.
			customCss: ['./src/styles/vibesmith-theme.css'],
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/tombee/vibesmith-docs',
				},
			],
			// Dark mode is the brand register — the framework app is
			// dark; the docs site should match. Disabling the toggle
			// keeps the visual register coherent across both surfaces.
			// (Visitors who prefer light theme can use browser reader
			// mode; the agent-discoverable manifest is theme-neutral.)
			//
			// Sidebar intentionally omits the `/agents/` page. The
			// agent-focused content is reachable via `/agents/` URL +
			// `llms.txt` (the agent manifest) — both crawlable. We
			// just don't put it in the human sidebar; it's reading
			// material for AI agents, not for human readers browsing
			// the docs.
			sidebar: [
				{
					label: 'Getting started',
					items: [
						{ label: 'Home', slug: 'index' },
						{ label: 'What vibesmith is', slug: 'introduction' },
						{ label: 'Comparisons FAQ', slug: 'faq' },
						{ label: 'Positioning', slug: 'positioning' },
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
			],
		}),
	],
});
