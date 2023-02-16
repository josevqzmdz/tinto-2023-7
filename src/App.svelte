<script lang="ts">
	import Header from "./components/Header.svelte";
	import Home from "./components/Home.svelte";
	import About from "./components/About.svelte";
	import Features from "./components/Features.svelte";
	import Footer from "./components/Footer.svelte";
	import { t, locale, locales } from "./i18n";
	$: time = new Date().toLocaleDateString($locale, {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});
</script>

<div class="root">
	<Header />
	<Home />
	<About />
	<Features />
	<Footer />
</div>

<style>
	.root {
		background: black;
		width: 100%;
		height: 100%;
	}
</style>
