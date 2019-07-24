"use strict";

const { toMatchSnapshot } = require("jest-snapshot");

expect.extend({
    toMatchRollupCodeSnapshot({ output }) {
        const out = Object.create(null);
        
        output.forEach(({ isAsset, name, code }) => {
            if(isAsset) {
                return;
            }

            out[name] = code;
        });

        return toMatchSnapshot.call(
            this,
            out,
        );
    },
});
