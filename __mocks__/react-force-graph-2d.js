// Mock for react-force-graph-2d
const React = require('react');

module.exports = function ForceGraph2D(props) {
  return React.createElement('div', {
    'data-testid': 'force-graph-2d-mock',
    className: 'force-graph-2d-mock'
  }, 'ForceGraph2D Mock');
};