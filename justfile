dev:
    hugo serve --disableFastRender --buildDrafts --gc

clean:
    rm -rf public/ resources/_gen/
    hugo mod clean