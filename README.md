# CatGPT

CatGPT is a static Jekyll site for GitHub Pages. A cat can walk across the keyboard, producing nonsense input that CatGPT confidently interprets as a cat-specific question before returning a preloaded response.

## Structure

```text
.
├── _config.yml
├── _data/
│   └── topics.yml
├── _includes/
│   └── icon-sprite.html
├── _layouts/
│   └── catgpt.html
├── assets/
│   ├── css/
│   │   └── catgpt.css
│   ├── images/
│   │   └── catgpt.svg
│   └── js/
│       └── catgpt.js
├── .gitignore
├── Gemfile
├── README.md
├── index.html
├── jek.sh
├── kill_serve.sh
└── robots.txt
```

`_data/topics.yml` is the single source of truth for prompts, keyboard mash strings, inferred questions and answers. Both the HTML interface and JavaScript are generated from that file by Jekyll.

## Local development

```bash
bundle install
./jek.sh
```

The site opens at `http://127.0.0.1:4000/`. `./kill_serve.sh` stops the server started by `jek.sh`.

## GitHub Pages

For a user or organisation Pages repository, or for a custom domain, leave `baseurl` empty.

For a project Pages repository such as `https://DylanLawless.github.io/catgpt/`, set:

```yaml
baseurl: "/catgpt"
```

Then publish the repository root from the `main` branch in GitHub Pages settings. No build workflow is required for the standard GitHub Pages Jekyll build.
