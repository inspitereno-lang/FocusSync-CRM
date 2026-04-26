/**
 * Environment Accessor
 * 
 * This file abstracts the environment access to avoid for easier testing.
 * Uses a runtime evaluation trick to hide import.meta from Node.js parser.
 */

const getEnv = () => {
  const global = globalThis as any;
  if (global.process && global.process.env && global.process.env.NODE_ENV === 'test') {
    return global.process.env;
  }
  try {
    // Hide import.meta from Node parser to avoid SyntaxError
    return new Function('return import.meta.env')();
  } catch (e) {
    return (global.process && global.process.env ? global.process.env : {});
  }
};

export const env = getEnv();
