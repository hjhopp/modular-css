/* eslint max-statements: "off" */
"use strict";

const path = require("path");

const dedent = require("dedent");
const Processor = require("@modular-css/processor");

const { transform } = require("../css-to-js.js");

const root = path.resolve(__dirname, "../../../").replace(/\\/g, "/");
const safe = "<ROOT-DIR>";

expect.addSnapshotSerializer({
    print(val) {
        return val.replace(root, safe);
    },
    test(val) {
        return typeof val === "string";
    },
});

const resolvers = [
    (src, file) =>
        // console.log({ src, file, result : path.join(path.dirname(src), file) });
        
         path.join(path.dirname(src), file),
];

describe("@modular-css/css-to-js API", () => {
    it("should be a function", () =>
        expect(typeof transform).toBe("function")
    );

    it("should generate javascript", async () => {
        const processor = new Processor({ resolvers });

        await processor.string("./a.css", `.a { color: red; }`);

        const { code, namedExports } = transform(processor.normalize("./a.css"), processor);

        expect(code).toMatchSnapshot("code");
        expect(namedExports).toEqual([ "a" ]);
    });

    it("should generate a javscript proxy in dev", async () => {
        const processor = new Processor({ resolvers });

        await processor.string("./a.css", `.a { color: red; }`);

        const { code } = transform(processor.normalize("./a.css"), processor, { dev : true });

        expect(code).toMatchSnapshot("code");
    });

    it("should generate empty results & a warning on invalid file input", async () => {
        const processor = new Processor({ resolvers });

        await processor.string("./a.css", `.a { color: red; }`);

        const { code, namedExports, warnings } = transform("./NOPE.css", processor);

        expect(code).toMatchSnapshot("code");
        expect(namedExports).toEqual([ ]);
        expect(warnings).toMatchSnapshot("warnings");
    });

    it("should represent local composition", async () => {
        const processor = new Processor({ resolvers });

        await processor.string("./a.css", `.a { color: blue; } .b { composes: a; }`);

        const { code, namedExports } = transform(processor.normalize("./a.css"), processor);

        expect(code).toMatchSnapshot("code");
        expect(namedExports).toEqual([ "a", "b" ]);
    });

    it("should represent external composition", async () => {
        const processor = new Processor({ resolvers });

        await processor.string("./a.css", `.a { color: red; }`);

        await processor.string("./b.css", `.b { composes: a from "./a.css"; color: blue; }`);

        const { code, namedExports } = transform(processor.normalize("./b.css"), processor);

        expect(code).toMatchSnapshot("code");
        expect(namedExports).toEqual([ "b" ]);
    });

    it("should use relative imports when requested", async () => {
        const processor = new Processor({ resolvers });

        await processor.string("./a.css", `.a { color: red; }`);

        await processor.string("./b.css", `.b { composes: a from "./a.css"; color: blue; }`);

        const { code, namedExports } = transform(processor.normalize("./b.css"), processor, { relativeImports : true });

        expect(code).toMatchSnapshot("code");
        expect(namedExports).toEqual([ "b" ]);
    });

    it("should output css when requested", async () => {
        const processor = new Processor({ resolvers });

        await processor.string("./a.css", `.a { color: red; }`);

        const { code, namedExports } = transform(processor.normalize("./a.css"), processor, { styleExport : true });

        expect(code).toMatchSnapshot("code");
        expect(namedExports).toEqual([ "a" ]);
    });

    it("should dedupe repeated identifiers", async () => {
        const processor = new Processor({ resolvers });

        await processor.string("./a.css", `.a { color: red; }`);
        await processor.string("./b.css", `.a { composes: a from "./a.css"; color: blue; }`);

        const { code, namedExports } = transform(processor.normalize("./b.css"), processor);

        expect(code).toMatchSnapshot("code");
        expect(namedExports).toEqual([ "a1 as a" ]);
    });

    it("should represent local @values", async () => {
        const processor = new Processor({ resolvers });

        await processor.string("./a.css", `@value v: #00F; .a { color: v; }`);

        const { code, namedExports } = transform(processor.normalize("./a.css"), processor);

        expect(code).toMatchSnapshot("code");
        expect(namedExports).toEqual([ "$values", "a" ]);
    });

    it("should represent external @values", async () => {
        const processor = new Processor({ resolvers });

        await processor.string("./a.css", `@value v: #00F;`);
        await processor.string("./b.css", `@value v from "./a.css"; .b { color: v; }`);

        const { code, namedExports } = transform(processor.normalize("./b.css"), processor);

        expect(code).toMatchSnapshot("code");
        expect(namedExports).toEqual([ "$values", "b" ]);
    });

    it("should represent external @values namespaces", async () => {
        const processor = new Processor({ resolvers });

        await processor.string("./a.css", `@value v1: #00F; @value v2: #F00; `);
        await processor.string("./b.css", dedent(`
            @value * as values from "./a.css";
            @value v: #0F0;

            .b {
                color: values.v1;
                background-color: values.v2;
                border-color: v;
            }
        `));

        const { code, namedExports } = transform(processor.normalize("./b.css"), processor);

        expect(code).toMatchSnapshot("code");
        expect(namedExports).toEqual([ "$values", "b" ]);
    });

    it.each([
        true,
        false,
        {},
        { rewriteInvalid : false },
        { warn : false },
        { rewriteInvalid : false, warn : false },
    ])("should handle options.namedExports set to: %s", async (namedExports) => {
        const processor = new Processor({ resolvers });

        await processor.string("./a.css", `.a-1 { color: red; }`);

        const { code, namedExports : exported, warnings } = transform(processor.normalize("./a.css"), processor, { namedExports });

        expect(code).toMatchSnapshot("code");
        expect(warnings).toMatchSnapshot("warnings");
        expect(exported).toMatchSnapshot("named exports");
    });
});