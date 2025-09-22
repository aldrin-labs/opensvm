import { test } from 'magnitude-test';

// Learn more about building test case:
// https://docs.magnitude.run/core-concepts/building-test-cases

const sampleTodos = [
    "Take out the trash",
    "Pay AWS bill",
    "Build more test cases with Magnitude"
];

test('can add and complete todos', { url: 'https://magnitodo.com' }, async (agent) => {
    await agent.act('create 3 todos', { data: sampleTodos.join(', ') });
    await agent.check('should see all 3 todos');
    await agent.act('mark each todo complete');
    await agent.check('says 0 items left');
});
