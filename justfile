dev:
    hugo serve --disableFastRender --buildDrafts --gc

clean:
    rm -rf public/ resources/_gen/
    hugo mod clean

# Build all incentive PDFs and asset bundles
build_incentives:
    ./scripts/build_incentive.py --all

# Build a single incentive PDF and asset bundle
build_incentive name:
    ./scripts/build_incentive.py {{name}}

# Production build of Hugo site (depends on incentives being built first)
build_blog: build_incentives
    HUGO_ENVIRONMENT=production HUGO_ENV=production hugo --gc --minify

# Validate Cloudflare worker bundles without deploying
[working-directory: 'cloudflare']
build_cloudflare:
    npm install
    npx wrangler deploy --dry-run

# Run Cloudflare worker tests
[working-directory: 'cloudflare']
test:
    npm install
    npm test

# Deploy blog (via GitHub Actions) and Cloudflare worker
[working-directory: 'cloudflare']
deploy: build_blog test
    gh workflow run hugo.yml
    npx wrangler deploy
