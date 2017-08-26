(function (root, factory) {
  if (typeof define === 'function' && define.amd) { // AMD.
    define(['exports'], factory);
  } else if (typeof exports === 'object' && typeof exports.nodeName !== 'string') { // CommonJS
    factory(exports);
  } else { // Browser globals
    root.Baduk = root.Baduk || {};
    factory(root.Baduk);
  }
}(this, function (exports) {

  // FIXME: implement a quick Set polyfill.

  // A given intersection on a board.
  function Intersection(x, y) {
    this.x = x;
    this.y = y;
    this.color = Board.EMPTY;
    this.group = null;
    this.territory = null;  // Used for score counting.
    this.turnPlayed = -1;
    this.capturesFromMove = 0;  // Number of enemy stones it would capture.
    // Number of own stones it would place in jeopardy.
    this.selfAtariFromMove = 0;
    this.libertiesFromMove = 0; // Group liberty count from move.
    this.sensibleMove = true;  // ie, legal and does not fill its own eyes.
    // FIXME: set the following values correctly.
    this.wasJustCaptured = false;  // Did a capture just happen here?
    // Change in number of own/enemy liberties from making a move here.
    this.ownLibertiesChange = 0;
    this.enemyLibertiesChange = 0;
    this.leadsToLadderCapture = false;
    this.leadsToLadderEscape = false;
  }

  Intersection.prototype = {
    toString: function() {
      return coordFromNum(this.x) + coordFromNum(this.y);
    },
  };

  function Group(board, intersections) {
    this.board = board;
    this.color = Board.EMPTY;
    this.intersections = new Set();
    this.liberties = new Set();  // Set of intersections.
    var self = this;
    intersections.forEach(function(intersection) {
      self.addIntersection(intersection);
    });
  }

  Group.prototype = {
    addIntersection: function(intersection) {
      this.intersections.add(intersection);
      this.color = intersection.color;
      intersection.group = this;
      var neighbors = this.board.surrounding(intersection.x, intersection.y);
      for (var i = 0; i < neighbors.length; i++) {
        var neighbor = neighbors[i];
        if (neighbor.color === Board.EMPTY) {
          this.liberties.add(neighbor);
        }
      }
    },
    toString: function() {
      var intersections = this.intersections.map(function(intersection) {
        return intersection.toString();
      });
      var liberties = this.liberties.map(function(intersection) {
        intersection.toString();
      });
      return "(" + stringFromColor(this.color) + " group on intersections " +
        intersections.join(", ") +
        " with liberties " + liberties.join(", ") + ")";
    },
  };

  function Territory(board, intersections) {
    this.board = board;
    this.color = -1;  // Unknown color.
    this.intersections = new Set();
    var self = this;
    intersections.forEach(function(intersection) {
      self.addIntersection(intersection);
    });
  }

  Territory.prototype = {
    addIntersection: function(intersection) {
      this.intersections.add(intersection);
      intersection.territory = this;
      var neighbors = this.board.surrounding(intersection.x, intersection.y);
      for (var i = 0; i < neighbors.length; i++) {
        var neighbor = neighbors[i];
        if (neighbor.color !== Board.EMPTY) {
          if (this.color === -1) {  // Previously unknown ownership.
            this.color = neighbor.color;
          } else if (this.color > Board.EMPTY &&
                     this.color !== neighbor.color) {
            // Border contains stones of different colors.
            this.color = Board.EMPTY;
          }
        }
      }
    },
    toString: function() {
      var intersections = this.intersections.map(function(intersection) {
        return intersection.toString();
      });
      return "(" + stringFromColor(this.color) + " territory on intersections " +
        intersections.join(", ") + ")";
    },
  };

  // options:
  //   - size: typically 19.
  //   - komi: floating-point number.
  function Board(options) {
    options = options || {};
    this.size = +options.size || 19;
    this.komi = +options.komi || 7.5;
    this.board = new Array(this.size * this.size);
    for (var y = 0; y < this.size; y++) {
      for (var x = 0; x < this.size; x++) {
        this.board[x + y * this.size] = new Intersection(x, y);
      }
    }
    this.groups = new Set();
    this.nextPlayingColor = Board.BLACK;
    this.captures = [0, 0, 0];  // Stones captured by empty, black, white.
    this.numMoves = 0;
    this.hash = 0;
    this.previousHashes = new Set();
  }

  Board.prototype = {
    // Is this intersection valid?
    has: function(x, y) {
      return y >= 0 && x >= 0 && y < this.size && x < this.size;
    },
    directGet: function(x, y) { return this.board[x + y * this.size]; },
    directSet: function(x, y, color) {
      this.board[x + y * this.size].color = color;
    },
    // x, y: integer positions of an intersection on the board.
    get: function(x, y) {
      if (this.has(x, y)) { return this.directGet(x, y); }
    },
    set: function(x, y, color) {
      if (this.has(x, y)) {
        this.directSet(x, y, color);
        if (color !== Board.EMPTY) {
          var intersection = this.directGet(x, y);
          var surrounding = this.surrounding(x, y);
          var ownSurroundingGroups = [];
          for (var i = 0; i < surrounding.length; i++) {
            var neighbor = surrounding[i];
            if (neighbor.color === color) {
              ownSurroundingGroups.push(neighbor.group);
            }
          }
          this.mergeStoneInGroups(intersection, ownSurroundingGroups);
        }
      }
    },
    // list: array of [row number, column number].
    setList: function(list, color) {
      for (var i = 0; i < list.length; i++) {
        this.set(list[i].x, list[i].y, color);
      }
    },

    // Create a new group that is the union of the given groups.
    mergeGroups: function(groups) {
      var intersections = [];
      for (var i = 0; i < groups.length; i++) {
        var group = groups[i];
        group.intersections.forEach(function(intersection) {
          intersections.push(intersection);
        });
      }
      return new Group(this, intersections);
    },

    // Add a stone to a list of groups (typically, its surrounding groups).
    mergeStoneInGroups: function(intersection, ownSurroundingGroups) {
      var currentGroup = this.mergeGroups(ownSurroundingGroups);
      currentGroup.addIntersection(intersection);
      for (var i = 0; i < ownSurroundingGroups.length; i++) {
        var group = ownSurroundingGroups[i];
        this.groups.delete(group);
      };
      this.groups.add(currentGroup);
    },

    surrounding: function(x, y) {
      var top    = this.get(x    , y - 1);
      var right  = this.get(x + 1, y    );
      var bottom = this.get(x    , y + 1);
      var left   = this.get(x - 1, y    );
      var neighbors = [];
      if (top    !== undefined) { neighbors.push(top); }
      if (right  !== undefined) { neighbors.push(right); }
      if (bottom !== undefined) { neighbors.push(bottom); }
      if (left   !== undefined) { neighbors.push(left); }
      return neighbors;
    },

    // Returns true if the move is authorized by the game rules.
    // Sets the intersection's capturesFromMove, selfAtariFromMove,
    // libertiesFromMove, sensibleMove.
    isValidMove: function(x, y) {
      var self = this;
      if (!this.has(x, y)) { return false; }
      var intersection = self.directGet(x, y);
      var color = self.nextPlayingColor;
      if (intersection.color !== Board.EMPTY) { return false; }
      self.directSet(x, y, color);
      var playedInterIdx = x + y * this.size;
      var newHash = self.hash ^ Board.ZOBRIST_VECTOR[color * playedInterIdx];

      // Reset properties.
      intersection.capturesFromMove = 0;
      intersection.selfAtariFromMove = 0;
      intersection.libertiesFromMove = 0;
      intersection.sensibleMove = true;

      // Get surrounding groups.
      var surrounding = self.surrounding(x, y);
      var surroundingGroups = [];
      var ownSurroundingGroups = [];
      var enemySurroundingGroups = [];
      var capturedEnemyGroups = [];
      var capturesFromMove = 0;
      var selfAtariFromMove = 0;
      var libertiesFromMove = 0;
      var enemyColor = (color === Board.BLACK) ? Board.WHITE : Board.BLACK;
      for (var i = 0; i < surrounding.length; i++) {
        var neighbor = surrounding[i];
        if (neighbor.color !== Board.EMPTY) {
          var group = neighbor.group;
          surroundingGroups.push(group);
          if (group.color === color) {
            ownSurroundingGroups.push(group);
          } else {
            enemySurroundingGroups.push(group);
            if (group.liberties.size === 1) {
              capturedEnemyGroups.push(group);
              capturesFromMove += group.intersections.size;
              group.intersections.forEach(function(intersection) {
                newHash ^= Board.ZOBRIST_VECTOR[enemyColor *
                  (intersection.x + intersection.y * self.size)];
              });
            }
          }
        }
      }

      var numberOfEmptyNeighbors = 0;
      for (var i = 0; i < surrounding.length; i++) {
        var neighbor = surrounding[i];
        if (neighbor.color === Board.EMPTY) {
          numberOfEmptyNeighbors++;
        }
      }
      libertiesFromMove = numberOfEmptyNeighbors;
      var newGroupSize = 1;
      for (var i = 0; i < ownSurroundingGroups.length; i++) {
        var group = ownSurroundingGroups[i];
        libertiesFromMove += group.liberties.size - 1;
        newGroupSize += group.intersections.size;
      }

      if (capturedEnemyGroups.length === 0) {
        // We are not capturing enemy stones. Are we committing suicide?
        var isKillingOwnGroup = libertiesFromMove === 0;
        var isSelfAtari = libertiesFromMove === 1;
        if (isKillingOwnGroup) {
          // Undo the insertion of a stone.
          self.directSet(x, y, Board.EMPTY);
          intersection.sensibleMove = false;
          return false;
        } else if (isSelfAtari) {
          intersection.selfAtariFromMove = newGroupSize;
        }
      } else {  // We are capturing enemy stones.
        // Ko and positional superko detection.
        if (self.previousHashes.has(newHash)) {
          self.directSet(x, y, Board.EMPTY);
          intersection.sensibleMove = false;
          return false;
        }

        libertiesFromMove += capturedEnemyGroups.length;
        intersection.capturesFromMove = capturesFromMove;
      }
      intersection.libertiesFromMove = libertiesFromMove;

      // Undo the insertion of a stone.
      self.directSet(x, y, Board.EMPTY);
      return true;
    },

    // Place a stone. Returns true if the move was valid.
    play: function(x, y) {
      var self = this;
      if (!this.has(x, y)) { return false; }
      var intersection = self.directGet(x, y);
      var color = self.nextPlayingColor;
      if (intersection.color !== Board.EMPTY) { return false; }
      self.directSet(x, y, color);
      var playedInterIdx = x + y * this.size;
      var newHash = self.hash ^ Board.ZOBRIST_VECTOR[color * playedInterIdx];

      // Get surrounding groups.
      var surrounding = self.surrounding(x, y);
      var surroundingGroups = [];
      var ownSurroundingGroups = [];
      var enemySurroundingGroups = [];
      var capturedEnemyGroups = [];
      var enemyColor = (color === Board.BLACK) ? Board.WHITE : Board.BLACK;
      for (var i = 0; i < surrounding.length; i++) {
        var neighbor = surrounding[i];
        if (neighbor.color !== Board.EMPTY) {
          var group = neighbor.group;
          surroundingGroups.push(group);
          if (group.color === color) {
            ownSurroundingGroups.push(group);
          } else {
            enemySurroundingGroups.push(group);
            if (group.liberties.size === 1) {
              capturedEnemyGroups.push(group);
              group.intersections.forEach(function(intersection) {
                newHash ^= Board.ZOBRIST_VECTOR[enemyColor *
                  (intersection.x + intersection.y * self.size)];
              });
            }
          }
        }
      }

      if (capturedEnemyGroups.length === 0) {
        // We are not capturing enemy stones. Are we committing suicide?
        var numberOfEmptyNeighbors = 0;
        for (var i = 0; i < surrounding.length; i++) {
          var neighbor = surrounding[i];
          if (neighbor.color === Board.EMPTY) {
            numberOfEmptyNeighbors++;
          }
        }
        var isLastLibertyOfAllOwnGroups = true;
        for (var i = 0; i < ownSurroundingGroups.length; i++) {
          var group = ownSurroundingGroups[i];
          if (group.liberties.size !== 1) {
            isLastLibertyOfAllOwnGroups = false;
            break;
          }
        }
        var isKillingOwnGroup = isLastLibertyOfAllOwnGroups &&
                                (numberOfEmptyNeighbors === 0);
        if (isKillingOwnGroup) {
          // Undo the insertion of a stone.
          self.directSet(x, y, Board.EMPTY);
          return false;
        }
      }

      // Ko and positional superko detection.
      else if (self.previousHashes.has(newHash)) {
        self.directSet(x, y, Board.EMPTY);
        return false;
      }

      self.mergeStoneInGroups(intersection, ownSurroundingGroups);

      for (var i = 0; i < enemySurroundingGroups.length; i++) {
        var group = enemySurroundingGroups[i];
        group.liberties.delete(intersection);
      }

      for (var i = 0; i < capturedEnemyGroups.length; i++) {
        var group = capturedEnemyGroups[i];
        self.groups.delete(group);
        self.captures[color] += group.intersections.size;
        group.intersections.forEach(function(intersection) {
          intersection.group = null;
          intersection.color = Board.EMPTY;
          // This intersection's stone was captured.
          // Add the liberties to its neighbors.
          var surrounding = self.surrounding(intersection.x, intersection.y);
          for (var j = 0; j < surrounding.length; j++) {
            var neighbor = surrounding[j];
            if (neighbor.color !== Board.EMPTY) {
              neighbor.group.liberties.add(intersection);
            }
          }
        });
      }

      self.hash = newHash;
      self.previousHashes.add(self.hash);
      intersection.turnPlayed = self.numMoves;
      self.numMoves++;
      self.nextTurn();
      return true;
    },

    pass: function() { this.nextTurn(); },

    nextTurn: function() {
      if (this.nextPlayingColor === Board.BLACK) {
        this.nextPlayingColor = Board.WHITE;
      } else {
        this.nextPlayingColor = Board.BLACK;
      }
    },

    scores: function() {
      var blackScore = 0, whiteScore = 0;
      this.computeTerritories();
      for (var y = 0; y < this.size; y++) {
        for (var x = 0; x < this.size; x++) {
          var intersection = this.board[x + y * this.size];
          if      (intersection.color === Board.BLACK) { blackScore++; }
          else if (intersection.color === Board.WHITE) { whiteScore++; }
          else if (intersection.territory.color === Board.BLACK) { blackScore++; }
          else if (intersection.territory.color === Board.WHITE) { whiteScore++; }
        }
      }

      blackScore += this.captures[Board.BLACK];
      whiteScore += this.captures[Board.WHITE];
      whiteScore += this.komi;
      return {black: blackScore, white: whiteScore};
    },

    // Return the color of the winner (0 if it is a draw).
    winner: function() {
      var scores = this.scores();
      var blackScore = scores.black;
      var whiteScore = scores.white;
      if      (blackScore > whiteScore) { return Board.BLACK; }
      else if (whiteScore > blackScore) { return Board.WHITE; }
      else { return Board.EMPTY; }
    },

    computeTerritories: function() {
      for (var y = 0; y < this.size; y++) {
        for (var x = 0; x < this.size; x++) {
          var intersection = this.board[x + y * this.size];
          if (intersection.color === Board.EMPTY) {
            var top = this.get(x, y - 1);
            var left = this.get(x - 1, y);
            if (top !== undefined && top.territory !== null) {
              top.territory.addIntersection(intersection);
              if (left !== undefined && left.territory !== null) {
                // Merge left and top territories.
                var topHasLargerTerritory =
                  (top.territory.intersections.size >
                   left.territory.intersections.size);
                var largerTerritory =
                  topHasLargerTerritory? top.territory: left.territory;
                var smallerTerritory =
                  topHasLargerTerritory? left.territory: top.territory;
                smallerTerritory.intersections.forEach(
                  function(smallIntersection) {
                    largerTerritory.addIntersection(smallIntersection);
                  }
                );
              }
            } else if (left !== undefined && left.territory !== null) {
              left.territory.addIntersection(intersection);
            } else {
              intersection.territory = new Territory(this, [intersection]);
            }
          }
        }
      }
    },

    toString: function() {
      var rows = "  ";
      for (var i = 0; i < this.size; i++) {
        rows += coordFromNum(i);
      }
      rows += "\n ┌";
      for (var i = 0; i < this.size; i++) {
        rows += "─";
      }
      rows += "┐\n";
      for (var y = 0; y < this.size; y++) {
        rows += coordFromNum(y) + "│";
        for (var x = 0; x < this.size; x++) {
          var intersection = this.directGet(x, y);
          if (intersection.color === Board.EMPTY) {
            rows += " ";
          } else if (intersection.color === Board.BLACK) {
            rows += "●";
          } else if (intersection.color === Board.WHITE) {
            rows += "○";
          }
        }
        rows += "│\n";
      }
      rows += " └";
      for (var i = 0; i < this.size; i++) {
        rows += "─";
      }
      rows += "┘\n";
      rows += "Captured: black " + this.captures[Board.BLACK] +
                      ", white " + this.captures[Board.WHITE];
      return rows;
    },
  };

  Board.EMPTY = 0;
  Board.BLACK = 1;
  Board.WHITE = 2;

  // The vector for Zobrist hashing uses a random 32-bit integer for each
  // state (black/white) in each position.
  // The vector is fixed to ensure reproducibility.
  // It was generated from this on Linux:
  // var numBytes = 19 * 19 // each position on the board
  //    * 2 // black/white
  //    * 4 // four bytes makes a 32-bit integer.
  // var b = crypto.randomBytes(numBytes);
  // var array = [];
  // var b = crypto.randomBytes(numBytes);
  // for (var i = 0; i < numBytes; i += 4) {
  //   array.push((b[i])+(b[i+1]<<8)+(b[i+2]<<16)+(b[i+3]<<24));
  // }
  Board.ZOBRIST_VECTOR = [
      175000578,371989679,-1434565504,-1463417609,-443332346,-933332435,1739358569,1840012156,-1445276896,2122728524,1877102694,1778380753,1996020918,-16166040,556816393,179289269,-114287903,-1624776471,1170178193,1432583092,409524829,-1162273333,-199254580,-331848762,-115017828,555936048,2008941745,1876502557,1544345474,1958296973,1774268588,-448592657,1809780217,1672834291,1792447996,-1376148059,-520224599,-336255414,-1808849061,-1917538086,-1069907303,-1424762043,175457627,-1974890754,1619204620,252294581,412879583,-88762449,-1551904245,-1142075105,-752805113,-831569397,-2130118686,-632959320,161033639,-1264804664,-863969,1917835321,-2096495121,1040482369,783334427,908001476,-1547011557,1141341366,-454978050,1769539280,-1812698481,-127519080,-1553292312,1471248968,-1476111026,-1206616741,1689180639,981939162,515711544,1699869938,-1371893605,710641566,-1335514713,1438246683,1041185637,-1342606289,636469338,-187796316,-21736363,1914153409,332450283,-1093489406,1564897116,-1542331676,690644628,-1516535918,-1132358750,-1668062915,1960173793,-460868890,77653100,871071850,-184608470,2032557036,-837073422,-969969940,-806795366,414693532,192099294,1329011286,1929509211,-1554627277,83488869,1767878986,-78491357,728607481,310642008,-1967725335,273264303,-2018911958,603305130,1160924099,-1636491862,-184060399,-1136735836,1412926722,-1700238585,-2004862510,-462119684,1146409538,1281254005,-380184330,1015288548,-102839537,1708545081,-1347606792,789925329,-540490969,-453074271,120946913,524089527,-475857412,-695793798,1465264174,185815019,691533044,1962882082,813191372,-77317866,-1902991717,-218378975,1362890961,-556963102,56935301,-574393910,664707896,-682912401,1583547045,-748179164,-1218120551,-2024955306,-1179132880,-69684510,-1944596252,684627577,2049960279,93551598,151973964,1561543923,369061477,-349269837,2009744425,665850744,-1435458961,-1323376065,-1701539375,414953622,67598636,-1543610878,-510646961,2027047291,76128719,94750301,1566501002,1682155136,-1872065791,2099892968,1749670411,-240068046,-1949937446,1830487406,-1564343742,-1812896737,-1687329321,1603502496,1818518119,1846364076,771060396,1685753070,539805552,90638490,-1008955079,957417099,-1903561615,-1503656474,520782017,1883754472,-1295587837,916165771,-1452133713,1116736487,-975455769,523216157,-1731137916,-730600946,1584815008,-1834401230,-1640476403,1660703170,543676944,2024942667,-208908345,1664309949,-1479827222,-748020442,1274754040,-804482199,1011727530,-1502116566,2009208826,526079311,1471658238,-935607529,-1663021650,1459702563,31471846,-68774546,-417205263,-40833804,63350050,474835960,1708187349,1094456154,-1573185955,-598494781,404276484,-540892022,2092386092,-582759072,711918920,1630307053,234476303,-1912491165,-912108459,444520113,201072893,-210775499,-1316449844,1943016679,207279375,430959877,-178841969,-2077093401,1207090454,-70226333,1369261133,1246041718,-1643689102,-435613466,-790944462,-2106468546,858596577,1112064755,1994340790,-789907726,-1847594891,138690990,1397506738,-1953967429,1969158994,-277182995,792702204,206435984,1739666299,1519882518,1990251215,379589603,2013074556,402712810,1102636776,1628212879,-269052902,468168189,1969939904,-1513059895,967920091,454016630,1049130808,1633811264,-92570249,-249063534,476472477,1878359237,-1781459993,370096674,-371641655,-87624044,-155919538,-2102716460,585366860,-1551857841,-1948450417,768962680,-216027,-2061449049,-1382812181,-917914928,-1166232677,-797164477,660303930,1713158251,-209268136,-1063197790,-1283447245,-1746813496,-1201619184,413099664,2115562305,-1921640893,752246457,-476838182,-1214641580,329154885,-1583751538,-127300516,-961453261,295748666,2078541626,1371356493,-1354753034,405815008,1716653847,-543783603,2123581423,362410894,-1645774767,993121146,897543876,-1784974763,-369500747,-1339695724,-604936569,964712029,-730327869,-1723185272,1408784896,-1327044060,-230767898,273313631,-42054108,375936627,2027617762,-781293040,-1685485374,-1691661369,-1483614995,1394088725,146158321,1119662738,952589044,1116911053,-1780483098,825316861,2105114252,12555919,-2063787910,1423381319,1513256050,209621963,-545611032,71825832,355549105,-1338839174,-12870098,1824201788,-1144680354,-1792545103,-1219848696,1856965442,144649281,1006306417,1246392227,-2049421953,-188126402,818439887,-729987889,-1756677262,-261172291,1977303916,624861552,2003823548,46242783,-1025979339,-1856805500,-465376024,-1214650230,-843051099,704351170,-113457488,419529651,1705360305,-2092855775,-1773116459,-1138441507,-246020347,997709066,1779782917,1156804160,1169805863,-392982379,895215811,1206435836,1358803426,1746754494,-1214617081,1232468623,-958253033,1270317439,-826327809,-1867671202,-1753190952,496916578,-1996873655,-1403777011,-77496402,-362508056,589399689,1100371501,-1247788091,-774381733,1669908548,978801278,-1703714249,1760113704,-31499182,384802454,165761599,-809329948,2132421201,-1437896409,1094679679,-770812770,1270313532,1835599626,-1862441244,-497797055,-2094981985,-1397431902,76165944,2143653756,-219106482,-1035130499,1584895399,2130101462,-269471201,-1793796701,-1990125344,2094959836,60698174,1022113656,449831975,-1772742305,1726107270,370814742,1624800969,1894202490,1818865363,-648719494,-1417143469,1032507050,1002435844,1151828240,1673910417,1338417632,364966019,678287881,1370479312,-535020386,440163881,-1894016862,2069128906,-554599110,-1639974991,-1166537262,-918777180,1325487157,-2028923098,368010327,-1036400249,-1871257496,151162781,-1872731770,-750030712,-1254859761,477704470,-1565801623,464190457,542082029,-1780978405,-250799495,-865835829,-1844395896,-2058120815,719082506,-1017748072,1991791079,-1541006805,-274524361,-1944675745,2122604786,-1517436330,2032319709,-1019882090,-74732410,-292300005,-942210051,582010437,1959945765,-1766768114,855674493,-997822158,437099394,1299396413,-1653588553,437957890,307530293,-330250579,-717774730,-1152021725,-1519730818,1900104229,-1843305284,-352702194,-204303332,-419962605,-1081314034,889662421,2098998754,1605000849,-2133070316,-928306267,242028620,-2145821807,1624157940,1544189495,2064183349,1230731216,1624616203,-826598051,830394865,-1569316740,-1253618325,-536128918,-1651706661,-1825912769,586524086,2005712059,-338745797,945372986,-1005786316,-1574938235,-1582616454,-1948784092,-1948632805,167813891,1548661994,1991539368,143470274,522248850,-1757941859,-1487280944,946754851,943726720,1066294905,63602282,-1588844765,-1601480572,-1868840317,1839153956,1704910641,-556975642,800142241,1139077169,1611498460,-1037954637,1887628485,490237529,-2102737607,-1404431343,-1449595622,1343182655,-1542131098,733183937,-797035275,-740903607,-189272658,-1128691300,1991011316,-1362851275,1338889514,-833085138,554849602,816575915,-917738882,-450780417,-1461174173,-42517159,-1133940936,834143957,1770609631,85662585,1929667759,-1516952121,991001473,1364142741,305943459,170184307,-346148,-1320504137,242257546,515074985,53901276,-213000635,1566538405,-2061761138,2016897585,1642596043,-1033483104,-1033166833,-1470970802,-297222226,-447512483,1605885732,1885619187,-100043122,1324562747,1223799666,45578284,698460915,-200560549,286469570,459650289,-217474251,416169637,-72703240,372801348,-426825189,1878290617,1253589764,2114758701,467925202,-1811407824,878134559,673999144,1196358250,-1763496484,45300417,1435329250,2104455745,1520187315,-902550615,1294950188,-243637057,-1358406106,-446021923,1592276271,77331227,1807904497,2088690006,1944154643,-1208564563,1487335970,-1354007601,-140421623,954660983,-1805289030,-1272717847,-1116229619,-1080350720,1377420771,-833725365,-2028170527,1788104552,-1023026155,42681094,-162085800,-1343202677,530271604,-1439749097,-2083858962,1136096091,-1468567511,-1865555537,1276345135,-1073308056,-1196802146,435597555,-2394916,-2145068966,-193822812,-1851210765,-1577585840,322558791,223083415,-1967594720,-1843761401,690791591,-854112134,788702070,-562164641,1272421588,-377982282,-542148975,723797003,-1251783409,-1685572476
  ];

  function stringFromColor(color) {
    switch (color) {
      case Board.EMPTY: return 'Empty';
      case Board.BLACK: return 'Black';
      case Board.WHITE: return 'White';
    }
  }
  Board.stringFromColor = stringFromColor;

  function coordFromNum(number) {
    if (number < 26) { return String.fromCharCode(97 + number); }
    else { return String.fromCharCode(65 + number - 26); }
  }
  Board.coordFromNum = coordFromNum;
  function coordFromMove(move) {
    return coordFromNum(move.x) + coordFromNum(move.y);
  }
  Board.coordFromMove = coordFromMove;

  exports.Board = Board;

}));
