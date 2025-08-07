// Mock for react-force-graph-3d
const React = require('react');

module.exports = function ForceGraph3D(props) {
  return React.createElement('div', {
    'data-testid': 'force-graph-3d-mock',
    className: 'force-graph-3d-mock'
  }, 'ForceGraph3D Mock');
};