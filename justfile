dev:
    hugo serve --disableFastRender --buildDrafts --gc

clean:
    rm -rf public/ resources/_gen/
    hugo mod clean

# Build all incentive PDFs and asset bundles
incentives:
    ./scripts/build_incentive.py --all

# Build a single incentive PDF and asset bundle
incentive name:
    ./scripts/build_incentive.py {{name}}
