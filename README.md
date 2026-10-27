# SAMc

SAM continuous (SAMc) is an interactive animated pictorial assessment technique derived from the 
original Self-Assessment Manikin (Bradley, and Lang, 1994).

This repository contains a JS module that defines a custom HTML element which can be used to render 
SAMc on a webpage.

## Usage

First, load the SAMc JS module in the `head` of a HTML page:

```html
<script type="module" src="sam-c.js"></script>
```

Now you can use the `sam-c` element in the page body:

```html
<sam-c valence="-0.43" arousal="0" dominance="1" animate></sam-c>
```

The `valence`, `arousal` and `dominance` attributes can be set from -1 to 1 (valence goes from 
negative to positive, arousal from low-energy to high-energy, and dominance from submissive to
dominant. Animation can be enabled and disabled using the `animate` boolean attribute.

## Demos

An animated instance of SAMc with sliders to change valence, arousal, and dominance can be found in
[demos/dynamic.html](./demos/dynamic.html) while [demos/dynamic.html](./demos/dynamic.html) displays
25 different combinations of valence, arousal, and dominance values with animation disabled.

Note that JS modules can’t be loaded locally (with a `file://` URL) so you’ll need to run a local
server to view the demos and use the SAMc JS module for local development.
