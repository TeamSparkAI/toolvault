import { expandPath } from './pathExpansion';

// Mock environment for testing
const mockEnv = {
    HOME: '/Users/testuser',
    PATH: '/usr/bin:/bin',
    _UNDERSCORE_VAR: 'test_value',
    _A: 'underscore_a',
    KUBECONFIG_PATH: '/path/to/kubeconfig'
};

console.log('Testing path expansion with new regex rules:');
console.log('==========================================');

const testCases = [
    {
        input: 'export $(grep -E \'KUBECONFIG_PATH=\' .env | xargs)',
        expected: 'export $(grep -E \'KUBECONFIG_PATH=\' .env | xargs)', // Should NOT expand
        description: 'Shell command with $ - should not expand'
    },
    {
        input: '$HOME/documents',
        expected: '/Users/testuser/documents',
        description: 'Valid env var - should expand'
    },
    {
        input: '${HOME}/documents',
        expected: '/Users/testuser/documents',
        description: 'Braced env var - should expand'
    },
    {
        input: '$_UNDERSCORE_VAR',
        expected: 'test_value',
        description: 'Underscore env var - should expand'
    },
    {
        input: '$_',
        expected: '$_', // Should NOT expand
        description: 'Underscore only - should not expand'
    },
    {
        input: '$_A',
        expected: 'underscore_a',
        description: 'Underscore followed by uppercase - should expand'
    },
    {
        input: '$_A_',
        expected: '$_A_', // Should NOT expand
        description: 'Ends with underscore - should not expand'
    },
    {
        input: '~/documents',
        expected: '/Users/testuser/documents',
        description: 'Home directory - should expand'
    },
    {
        input: 'echo $1',
        expected: 'echo $1', // Should NOT expand
        description: 'Starts with number - should not expand'
    },
    {
        input: 'echo $var',
        expected: 'echo $var', // Should NOT expand
        description: 'Lowercase - should not expand'
    },
    {
        input: 'echo $VAR_123',
        expected: 'echo $VAR_123', // Should NOT expand (not in mock env)
        description: 'Valid format but not in env - should not expand'
    }
];

testCases.forEach((testCase, index) => {
    const result = expandPath(testCase.input, mockEnv);
    const passed = result === testCase.expected;
    
    console.log(`\nTest ${index + 1}: ${testCase.description}`);
    console.log(`Input:  ${JSON.stringify(testCase.input)}`);
    console.log(`Output: ${JSON.stringify(result)}`);
    console.log(`Expected: ${JSON.stringify(testCase.expected)}`);
    console.log(`Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);
});

console.log('\n==========================================');
console.log('Test completed!'); 