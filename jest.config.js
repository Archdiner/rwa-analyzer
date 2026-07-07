/** @type {import('jest').Config} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
    },
    testMatch: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
    transform: {
        "^.+\\.ts$": [
            "ts-jest",
            {
                tsconfig: { module: "commonjs", esModuleInterop: true, isolatedModules: true },
            },
        ],
    },
    // On-chain / network fixtures live behind adapters; unit suites are pure.
    testPathIgnorePatterns: ["/node_modules/", "/.next/"],
};
