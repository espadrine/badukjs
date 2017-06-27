var Baduk = require('../../board.js');
var Board = Baduk.Board;

function DecisionTree(root) {
  this.root = root;
  this.relPointX = 0;      // Distance to targetted intersection index.
  this.relPointY = 0;      // Distance to targetted intersection index.
  this.parameter = 0;      // Element to study about the intersection.
  this.treeIf = [];        // DecisionTree to read for each parameter value.
  this.moveScoresIf = [];  // Proba of move matching the parameter value.
}

DecisionTree.prototype = {
  computeDecision: function(board, intersection, color, prevMove) {
    var targetNodeX = intersection.x + this.relPointX;
    var targetNodeY = intersection.y + this.relPointY;
    var targetNode = board.get(targetNodeX, targetNodeY);

    var parameter = this.parameter;
    if (parameter === PARAM_TYPE) {
      if (targetNode === undefined) { return VAL_OUT; }
      else if (targetNode.color === Board.EMPTY) { return VAL_EMPTY; }
      else if (targetNode.color === color) { return VAL_FRIEND; }
      else if (targetNode.color !== color) { return VAL_ENEMY; }
      else { console.error('invalid parameter', parameter); }
    } else if (parameter === PARAM_LIBERTY_COUNT) {
      if (targetNode === undefined || targetNode.group === null) {
        return VAL_ZERO;
      } else {
        var libertyCount = targetNode.group.liberties.size;
        if (libertyCount === 1) { return VAL_ONE; }
        else if (libertyCount === 2) { return VAL_TWO; }
        else { return VAL_THREE; }
      }
    } else if (parameter === PARAM_DIST_MOVE) {
      if (prevMove === undefined) { return VAL_ZERO_ONE; }
      var distance = Math.abs(prevMove.x - intersection.x) +
                     Math.abs(prevMove.y - intersection.y);
      if (distance === 1) { return VAL_ZERO_ONE; }
      else if (distance === 2 || distance === 3) { return VAL_TWO_THREE; }
      else if (distance === 4 || distance === 5) { return VAL_FOUR_FIVE; }
      else if (distance > 6) { return VAL_SIX; }
    } else if (parameter === PARAM_DIST_EDGE) {
      if (prevMove === undefined) { return VAL_ZERO_ONE; }
      var distance = Math.min(intersection.x, intersection.y,
        board.size - intersection.x - 1, board.size - intersection.y - 1);
      if (distance === 1) { return VAL_ZERO_ONE; }
      else if (distance === 2 || distance === 3) { return VAL_TWO_THREE; }
      else if (distance === 4 || distance === 5) { return VAL_FOUR_FIVE; }
      else if (distance > 6) { return VAL_SIX; }
    } else if (parameter === PARAM_MOVE_COUNT) {
      var count = board.numMoves;
      if (count < 50) { return VAL_ZERO_FIFTY; }
      else if (count < 100) { return VAL_FIFTY_HUNDRED; }
      else if (count < 150) { return VAL_HUNDRED; }
      else if (count >= 150) { return VAL_HUNDRED_FIFTY; }
    } else { console.error('invalid parameter', parameter); }
  },
  score: function(board, intersection, color, prevMove) {
    var decision = this.computeDecision(board, intersection, color, prevMove);
    if (this.treeIf[decision] === undefined) {
      return this.moveScoresIf[decision];
    } else {
      return this.treeIf[decision].score(board, intersection, color, prevMove);
    }
  },
  findMatchingLeaf: function(board, intersection, color, prevMove) {
    var decision = this.computeDecision(board, intersection, color, prevMove);
    if (this.treeIf[decision] === undefined) {
      return this;
    } else {
      return this.treeIf[decision].findMatchingLeaf(board, intersection, color, prevMove);
    }
  },
  guess: function(board, prevMove) {
    var color = board.nextPlayingColor;
    var maxScore = 0;
    var maxMoveX = 0;
    var maxMoveY = 0;
    var boardSize = board.size;
    for (var y = 0; y < boardSize; y++) {
      for (var x = 0; x < boardSize; x++) {
        var intersection = board.directGet(x, y);
        if (intersection.color !== Board.EMPTY) { continue; }
        intersection.score = this.score(board, intersection, color, prevMove);
        if (maxScore < intersection.score) {
          maxScore = intersection.score;
          maxMoveX = x;
          maxMoveY = y;
        }
      }
    }
    return {x: maxMoveX, y: maxMoveY, score: maxScore};
  },
  toJSON: function() {
    return {
      relPointX: this.relPointX,
      relPointY: this.relPointY,
      parameter: this.parameter,
      moveScoresIf: this.moveScoresIf,
      treeIf: this.treeIf,
    };
  },
};

// Data is a parsed version of what toJSON() would give.
DecisionTree.load = function(data, root) {
  var tree = new DecisionTree();
  root = root || tree;
  tree.relPointX = data.relPointX;
  tree.relPointY = data.relPointY;
  tree.parameter = data.parameter;
  tree.moveScoresIf = data.moveScoresIf;
  tree.treeIf = data.treeIf.map(function(subtree) {
    if (subtree === null) { return; }
    return DecisionTree.load(subtree, root);
  });
  return tree;
};

// trainingSet: function(function(board, move, prevMove))
DecisionTree.learn = function(treeSize, trainingSet) {
  var root = new DecisionTree();
  root.root = root;
  root.relPoints = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];
  root.forbiddenParameters = [];
  var leaves = [root];

  // Add the first node in the tree.
  var newLeaf = root;
  var stats = computeStats(trainingSet, root, newLeaf);
  setParamToLeaf(newLeaf, stats);

  for (var i = 1; i < treeSize; i++) {
    // Find the leaf with the highest move percentage.
    var max = findMaxLeaf(leaves);
    if (max === undefined) {
      console.error((new Error("Cannot grow tree size further than " + i)));
      break;
    }
    var parent = max.leaf;
    var maxIfValue = max.ifValue;
    var maxLeafIdx = max.index;

    // Expand the tree in this direction.
    newLeaf = expandLeaf(root, parent, maxIfValue, maxLeafIdx, leaves);

    // We must compute which parameter and value has the most move probability.
    stats = computeStats(trainingSet, root, newLeaf);
    setParamToLeaf(newLeaf, stats);
  }

  return root;
};

// Find the leaf with the highest move percentage.
function findMaxLeaf(leaves) {
  var maxLeaf = leaves[0];
  var maxMoveScore = 0;
  var maxIfValue = 0;  // The direction with the highest move probability.
  var maxLeafIdx = 0;
  var maxFound = false;
  for (var i = 0; i < leaves.length; i++) {
    var leaf = leaves[i];
    var parameter = leaf.parameter;
    var valuesForParam = valuesForParameter[parameter];
    for (var j = 0; j < valuesForParam.length; j++) {
      var value = valuesForParam[j];
      var valueScore = leaf.moveCountsIf[value];
      if (leaf.treeIf[value] === undefined &&
          valueScore > maxMoveScore) {
        maxLeaf = leaf;
        maxMoveScore = valueScore;
        maxIfValue = value;
        maxLeafIdx = i;
        maxFound = true;
      }
    }
  }
  if (!maxFound) { return; }
  return {
    leaf: maxLeaf,
    ifValue: maxIfValue,
    index: maxLeafIdx,
  };
}

function expandLeaf(root, parent, ifValue, leafIdx, leaves) {
  var newLeaf = new DecisionTree(root);
  parent.treeIf[ifValue] = newLeaf;

  // Add relative intersections.
  newLeaf.relPoints = parent.relPoints.slice();
  newLeaf.forbiddenParameters = parent.forbiddenParameters.slice();
  var newRelPoints = [];
  var surrounding = surroundingPoints(parent.relPointX, parent.relPointY);
  for (var i = 0; i < surrounding.length; i++) {
    var neighbor = surrounding[i];
    var neighborIsAlreadyIn = newLeaf.relPoints.some(function(point) {
      return sameIntersection(point, neighbor);
    });
    if (!neighborIsAlreadyIn) {
      newRelPoints.push({x: neighbor.x, y: neighbor.y});
    }
  }
  newLeaf.relPoints = newLeaf.relPoints.concat(newRelPoints);

  if (parent.treeIf[0] !== undefined && parent.treeIf[1] !== undefined &&
      parent.treeIf[2] !== undefined && parent.treeIf[3] !== undefined) {
    // This is no longer a leaf.
    leaves.splice(leafIdx, 1)
  }
  leaves.push(newLeaf);

  return newLeaf;
}

function computeStats(trainingSet, root, newLeaf) {
  var stats = setupStats(newLeaf);
  trainingSet(function(board, move, prevMove) {
    if (move.x < 0) { return; }
    var color = board.nextPlayingColor;
    for (var y = 0; y < board.size; y++) {
      for (var x = 0; x < board.size; x++) {
        var intersection = board.directGet(x, y);
        if (intersection.color !== Board.EMPTY) { continue; }
        var isMove = sameIntersection(move, intersection);
        computeStatsForPoint(board, intersection, color, prevMove, isMove,
          stats, root, newLeaf);
      }
    }
  });
  return stats;
}

function setupStats(newLeaf) {
  var stats = {};
  var relPoints = newLeaf.relPoints;
  for (var i = 0; i < relPoints.length; i++) {
    var relPoint = relPoints[i];
    if (stats[relPoint.x] === undefined) { stats[relPoint.x] = {}; }
    stats[relPoint.x][relPoint.y] = [];
    for (var j = 0; j < parameters.length; j++) {
      var parameter = parameters[j];
      stats[relPoint.x][relPoint.y][parameter] = [];
      var valuesForParam = valuesForParameter[parameter];
      for (var k = 0; k < valuesForParam.length; k++) {
        var value = valuesForParam[k];
        stats[relPoint.x][relPoint.y][parameter][value] = {
          moveMatches: 0,
          matches: 0,
        };
      }
    }
  }
  return stats;
}

function computeStatsForPoint(
board, intersection, color, prevMove, isMove, stats, root, newLeaf) {
  var matchingLeaf = root.findMatchingLeaf(board, intersection, color, prevMove);
  var relPoints = matchingLeaf.relPoints;
  if (matchingLeaf === newLeaf) {
    // This is the leaf we want to study.
    forEachParameterAndValue(relPoints, function(point, param, value) {
      var parameterMatch = intersectionMatchesParameter(point, param, value,
        board, intersection, color, prevMove);
      if (parameterMatch) {
        if (isMove) {
          stats[point.x][point.y][param][value].moveMatches++;
        }
        stats[point.x][point.y][param][value].matches++;
      }
    });
  }
}

// use: function(point, parameter, value) called once for each combination.
function forEachParameterAndValue(relPoints, use) {
  for (var i = 0; i < relPoints.length; i++) {
    var relPoint = relPoints[i];
    for (var j = 0; j < parameters.length; j++) {
      var parameter = parameters[j];
      var valuesForParam = valuesForParameter[parameter];
      for (var k = 0; k < valuesForParam.length; k++) {
        var value = valuesForParam[k];
        use(relPoint, parameter, value);
      }
    }
  }
}

function intersectionMatchesParameter(targetIntersection, param, value,
                                      board, intersection, color, prevMove) {
  var decision = new DecisionTree();
  decision.parameter = param;
  decision.relPointX = targetIntersection.x;
  decision.relPointY = targetIntersection.y;
  return decision.computeDecision(board, intersection, color, prevMove) === value;
}

function setParamToLeaf(newLeaf, stats) {
  var maxMaxMoveScore = 0;
  var maxMoveScores = [];
  var maxMoveCounts = [];
  var maxParam = 0;
  var maxRelPointX = -1;
  var maxRelPointY = -1;
  for (var relPointX in stats) {
    for (var relPointY in stats[relPointX]) {
      var pointStats = stats[relPointX][relPointY];
      for (var param = 0; param < pointStats.length; param++) {
        if (isForbiddenParameter(+relPointX, +relPointY, param,
              newLeaf.forbiddenParameters)) {
          continue;
        }
        var paramStats = pointStats[param];
        var moveScores = [];
        var moveCounts = [];
        var maxMoveScore = 0;
        var sumMoveScore = 0;
        for (var value = 0; value < paramStats.length; value++) {
          moveCounts[value] = paramStats[value].moveMatches;
          moveScores[value] = wilsonScore(paramStats[value]);
          if (maxMoveScore < moveScores[value]) {
            maxMoveScore = moveScores[value];
          }
          sumMoveScore += moveScores[value];
        }
        var isBetterMoveScore = maxMaxMoveScore < maxMoveScore;
        var isChoice = sumMoveScore > maxMoveScore;
        if (isBetterMoveScore && isChoice) {
          maxMaxMoveScore = maxMoveScore;
          maxMoveScores = moveScores;
          maxMoveCounts = moveCounts;
          maxParam = param;
          maxRelPointX = +relPointX;
          maxRelPointY = +relPointY;
        }
      }
    }
  }
  newLeaf.relPointX = maxRelPointX;
  newLeaf.relPointY = maxRelPointY;
  newLeaf.parameter = maxParam;
  newLeaf.moveScoresIf = maxMoveScores;
  newLeaf.moveCountsIf = maxMoveCounts;
  newLeaf.forbiddenParameters.push({
    relPointX: newLeaf.relPointX,
    relPointY: newLeaf.relPointY,
    parameter: newLeaf.parameter,
  });
}

function isForbiddenParameter(relPointX, relPointY, param, forbiddenParams) {
  for (var i = 0; i < forbiddenParams.length; i++) {
    var forbiddenParam = forbiddenParams[i];
    if (forbiddenParam.relPointX === relPointX &&
        forbiddenParam.relPointY === relPointY &&
        forbiddenParam.parameter === param) { return true; }
  }
  return false;
}

// Compute the probability that this move is recommended.
// We use the lower bound of the Wilson score for a binomial proportion
// confidence interval at 95% confidence.
function wilsonScore(matchStats) {
  var moves = matchStats.moveMatches;
  var n = matchStats.matches;
  if (n === 0) { return 0; }
  var z = 1.96, phat = moves / n;
  return (phat + z*z/(2*n) - z * Math.sqrt((phat*(1-phat)+z*z/(4*n))/n))/(1+z*z/n);
}

function basicScore(matchStats) {
  if (matchStats.matches === 0) { return 0; }
  return matchStats.moveMatches / matchStats.matches;
}

function surroundingPoints(x, y) {
  return [{x: x, y: y-1}, {x: x+1, y: y}, {x: x, y: y+1}, {x: x-1, y: y}];
}

function sameIntersection(a, b) {
  return a.x === b.x && a.y === b.y;
}

// Node parameters for decision tree conditions.
var PARAM_TYPE          = 0;
var PARAM_LIBERTY_COUNT = 1;
var PARAM_DIST_MOVE     = 2;
var PARAM_DIST_EDGE     = 3;
var PARAM_MOVE_COUNT    = 4;

// Parameter values.
// First, for PARAM_TYPE.
var VAL_OUT    = 0;
var VAL_EMPTY  = 1;
var VAL_FRIEND = 2;
var VAL_ENEMY  = 3;
// Now, the counts.
var VAL_ZERO   = 0;
var VAL_ONE    = 1;
var VAL_TWO    = 2;
var VAL_THREE  = 3;  // or more.
var VAL_ZERO_ONE  = 0;
var VAL_TWO_THREE = 1;
var VAL_FOUR_FIVE = 2;
var VAL_SIX       = 3;  // or more.
var VAL_ZERO_FIFTY    = 0;  // 0-49
var VAL_FIFTY_HUNDRED = 1;  // 50-99
var VAL_HUNDRED       = 2;  // 100-149
var VAL_HUNDRED_FIFTY = 3;  // 150

var parameters = [PARAM_TYPE, PARAM_LIBERTY_COUNT, PARAM_DIST_MOVE, PARAM_DIST_EDGE, PARAM_MOVE_COUNT];
var valuesForParameter = [];
valuesForParameter[PARAM_TYPE] = [VAL_OUT, VAL_EMPTY, VAL_FRIEND, VAL_ENEMY];
valuesForParameter[PARAM_LIBERTY_COUNT] =
  [VAL_ZERO, VAL_ONE, VAL_TWO, VAL_THREE];
valuesForParameter[PARAM_DIST_MOVE] =
  [VAL_ZERO_ONE, VAL_TWO_THREE, VAL_FOUR_FIVE, VAL_SIX];
valuesForParameter[PARAM_DIST_EDGE] =
  [VAL_ZERO_ONE, VAL_TWO_THREE, VAL_FOUR_FIVE, VAL_SIX];
valuesForParameter[PARAM_MOVE_COUNT] =
  [VAL_ZERO_FIFTY, VAL_FIFTY_HUNDRED, VAL_HUNDRED, VAL_HUNDRED_FIFTY];

module.exports = DecisionTree;
