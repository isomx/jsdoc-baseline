# Overview
Contains styles for embedding the docs in isomx which uses react-md.

Additionally, it contains .light-theme and .dark-theme classes to match the themes between the docs and isomx site, including a matching Google code prettify theme (see https://jmblog.github.io/color-themes-for-google-code-prettify/)

# Usage

- `.light-theme` or `.dark-theme` to theme the docs.


- `.rmd-embed` to activate the "embed" styles to match the isomx site, which switches up some fonts and colors, and disables the main toolbar.


- `.rmd-embed .rmd-embed--no-nav` to disable the navigation (jqtree). The main thing it does it remove the styles around positioning the main content container as if the nav were present. Instead, the content container will be the full width of the iframe.


- `.rmd-embed .rmd-embed--with-nav` to add better nav/container positioning, including a media breakpoint.
