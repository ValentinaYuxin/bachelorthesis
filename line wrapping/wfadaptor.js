/*
  This file is part of cpee-layout.

  cpee-layout is free software: you can redistribute it and/or modify it under
  the terms of the GNU General Public License as published by the Free Software
  Foundation, either version 3 of the License, or (at your option) any later
  version.

  cpee-layout is distributed in the hope that it will be useful, but WITHOUT
  ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
  FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more
  details.

  You should have received a copy of the GNU General Public License along with
  cpee-layout (file COPYING in the main directory). If not, see
  <http://www.gnu.org/licenses/>.
*/

// TODO: changes in svg-script:
// 1) drawing functions
// 2) creation of svg-container (Bug: arrows on lines)
// 3) after-function to insert using namespace of description

// WfAdaptor:
// Handles interaction between Illustartor and Description
// e.g. Event fires to Adaptor to insert Element and Illustrator and Description do it
function WfAdaptor(theme_base, doit) { // Controller {{{

  // public variables {{{
  this.illustrator;
  this.description;
  this.elements = {};
  this.theme_base = theme_base;
  this.theme_dir = theme_base.replace(/theme.js/, '');
  // }}}

  // private variables {{{
  var illustrator;
  var description;
  var self = this;
  // }}}

  // helper funtions
  this.set_description = function (desc, auto_update) { // public {{{
    this.description.set_description(desc, auto_update);
  } // }}}

  this.get_description = function () { // public {{{
    return description.get_description();
  } // }}}
  this.notify = function () { // public {{{
  } // }}}
  this.draw_labels = function (max, labels, height_shift, striped) { // public {{{
  } // }}}

  this.set_svg_container = function (container) { // {{{

    //console.log(container.get(0))

    illustrator.set_svg_container(container); // TODO: shadowing the container element

  } // }}}


  this.set_label_container = function (container) { // {{{
    illustrator.set_label_container(container);
  } // }}}

  // initialize
  this.illustrator = illustrator = new WfIllustrator(this);
  this.description = description = new WfDescription(this, this.illustrator);

  this.update = function (doit) { doit(self); };

  $.getScript(theme_base, function () {
    manifestation = new WFAdaptorManifestation(self);
    illustrator.compact = manifestation.compact == true ? true : false;
    illustrator.striped = manifestation.striped == true ? true : false;
    description.source = manifestation.source;
    var deferreds = [];
    // copy parent stuff
    for (element in manifestation.elements) {
      if (manifestation.elements[element].parent) {
        if (!manifestation.elements[element].description) {
          manifestation.elements[element].description = manifestation.elements[manifestation.elements[element].parent].description;
        }
        if (!manifestation.elements[element].adaptor) {
          manifestation.elements[element].adaptor = manifestation.elements[manifestation.elements[element].parent].adaptor;
        }
        var ill = manifestation.elements[manifestation.elements[element].parent].illustrator;
        for (var key in ill) {
          if (manifestation.elements[element].illustrator[key] == undefined) {
            manifestation.elements[element].illustrator[key] = ill[key];
          }
        }
        if (manifestation.elements[element].type == undefined) {
          manifestation.elements[element].type = manifestation.elements[manifestation.elements[element].parent].type;
        }
      }
    }
    // doit
    for (element in manifestation.resources) {
      deferreds.push(
        $.ajax({
          type: "GET",
          dataType: "xml",
          url: manifestation.resources[element],
          context: element,
          success: function (res) {
            manifestation.resources[this] = $(res.documentElement);
          }
        })
      );
    }
    for (element in manifestation.elements) {
      if (manifestation.elements[element].illustrator) {
        if (manifestation.elements[element].illustrator.svg) {
          deferreds.push(
            $.ajax({
              type: "GET",
              dataType: "xml",
              url: manifestation.elements[element].illustrator.svg,
              context: element,
              success: function (res) {
                manifestation.elements[this].illustrator.svg = $(res.documentElement);
              }
            })
          );
        }
        illustrator.elements[element] = manifestation.elements[element].illustrator;
        illustrator.elements[element].type = manifestation.elements[element].type || 'abstract';
      }
      if (manifestation.elements[element].description) {
        if (typeof manifestation.elements[element].description === 'string') {
          manifestation.elements[element].description = [manifestation.elements[element].description];
        }
        if ($.isArray(manifestation.elements[element].description)) {
          for (const [ind, val] of Object.entries(manifestation.elements[element].description)) {
            deferreds.push(
              $.ajax({
                type: "GET",
                dataType: "xml",
                url: val,
                context: element,
                success: function (res) {
                  manifestation.elements[this].description = $(res.documentElement);
                  description.elements[this] = manifestation.elements[this].description;
                }
              })
            );
          };
        }
      }
      if (manifestation.elements[element].adaptor) {
        self.elements[element] = manifestation.elements[element].adaptor;
      }
    }
    $.when.apply($, deferreds).then(function (x) {
      doit(self);
    });
  });
} // }}}

function getComputedStyleForElement(element) {
  return window.getComputedStyle(element);
}

function applyComputedStyleToElement(element, computedStyle) {
  for (const property of computedStyle) {
    element.style.setProperty(property, computedStyle.getPropertyValue(property), computedStyle.getPropertyPriority(property));
  }
}

function getTextWidth(text, className) {
  // 创建一个 SVG 元素和一个文本元素
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');

  // 设置 CSS 类
  textElement.setAttribute('class', className);
  textElement.textContent = text;

  // 将文本元素添加到 SVG 中
  svg.appendChild(textElement);
  document.body.appendChild(svg);

  // 确保样式被应用
  const computedStyle = getComputedStyleForElement(document.querySelector(`.${className}`));
  applyComputedStyleToElement(textElement, computedStyle);

  // 获取文本的边界框信息
  const bbox = textElement.getBBox();
  const width = bbox.width;

  // 移除临时的 SVG 和文本元素
  svg.remove();

  return width;
}
function splitLabel(label, maxLength = 30) {
  if (typeof label !== 'string') {
    return "";
  }

  const words = label.split(' '); // 以空格拆分单词
  let result = "";

  for (let word of words) {
    if ((result + word).length > maxLength - 3) { // 预留 3 个字符给 "..."
      return result.trim() + "...";
    }
    result += word + " ";
  }

  return result.trim(); // 确保没有多余空格
}

function distributeWordsIntoLines(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return { line1: [], line2: [] };
  }

  const words = text.split(' '); // 以空格拆分单词
  let line1 = [words.shift()]; // 先放第一个单词到 line1
  let line2 = [words.pop()]; // 放最后一个单词到 line2

  let length1 = line1.join(' ').length;
  let length2 = line2.join(' ').length;

  while (words.length > 0) {
    if (length2 < length1) {
      let word = words.pop(); // 取倒数第二个单词
      line2.unshift(word); // 插入 line2 开头
      length2 += word.length + (line2.length > 1 ? 1 : 0); // 计算总长度
    } else {
      let word = words.shift(); // 取正数第二个单词
      line1.push(word); // 插入 line1 末尾
      length1 += word.length + (line1.length > 1 ? 1 : 0); // 计算总长度
    }
  }

  return { line1, line2 };
}
// WfIllustrator:
// Is in charge of displaying the Graph. It is further able insert and remove elements with given ID's from the illsutration.
function WfIllustrator(wf_adaptor) { // View  {{{
  // Variable {{{
  // public
  this.height = 40;
  this.width = 40;
  this.height_shift = this.height * 0.26;
  this.width_shift = this.width * 0.39;
  this.elements = {}; // the svgs
  this.svg = {};
  this.draw = {};
  this.compact = true;
  this.striped = true;
  // private
  var self = this;
  var adaptor = null;
  // }}}
  // Generic Functions {{{
  this.set_label_container = function (con) { // {{{
    self.svg.label_container = con;
  } // }}}
  this.set_svg_container = function (con) { // {{{
    self.svg.container = con;
    self.svg.container.append($X('<defs xmlns="http://www.w3.org/2000/svg">' +
      '  <marker id="arrow" viewBox="0 0 10 10" refX="33" refY="5" orient="auto" markerUnits="strokeWidth" markerWidth="4.5" makerHeight="4.5">' +
      '    <path d="m 2 2 l 6 3 l -6 3 z"/>' +
      '  </marker>' +
      '</defs>'));//图上的所有箭头

    self.svg.defs = {};
    self.svg.defs['unknown'] = $X('<g xmlns="http://www.w3.org/2000/svg" class="unknown">' +
      '<circle cx="15" cy="15" r="14" class="unkown"/>' +
      '<text transform="translate(15,20)" class="normal">?</text>' +
      '</g>');
    for (element in self.elements) {
      //console.log(element);

      if (self.elements[element].svg) {
        var sym = $X('<g xmlns="http://www.w3.org/2000/svg"/>').append(self.elements[element].svg.clone().children()); // append all children to symbol
        $.each(self.elements[element].svg.attr('class').split(/\s+/), function (index, item) { sym.addClass(item); }); // copy all classes from the root node
        self.svg.defs[element] = sym;
        //console.log(sym.get(0));
      }
    }
  } // }}}
  var clear = this.clear = function () { // {{{
    $('> :not(defs)', self.svg.container).each(function () { $(this).remove() });
  } // }}}
  this.set_svg = function (graph, width) { // {{{
    if (graph.max.row < 1) graph.max.row = 1;
    if (graph.max.col < 1) graph.max.col = 1;
    self.svg.container.attr('height', (graph.max.row) * self.height + self.height_shift);
    self.svg.container.attr('width', (graph.max.col + 0.55) * self.width + width); //0.55
    self.svg.container.append(graph.svg);
  } // }}}
  this.get_node_by_svg_id = function (svg_id) { // {{{
    return $('[element-id = \'' + svg_id + '\'] g.activities', self.svg.container);
  } // }}}
  this.get_label_by_svg_id = function (svg_id) { // {{{
    return $('[element-id = \'' + svg_id + '\']', self.svg.label_container);
  } // }}}
  this.get_elements = function () { // {{{
    return $('g.element', self.svg.container);
  } // }}}
  this.get_labels = function () { // {{{
    return $('[element-id]', self.svg.label_container);
  } // }}}
  // }}}
  // Helper Functions {{{
  var get_y = this.draw.get_y = function (row) { // {{{
    return { y: row * self.height - self.height, height_shift: self.height_shift };
  } // }}}

  var draw_stripe = this.draw.draw_stripe = function (row, maxcol) { // {{{
    if (maxcol < 1) maxcol = 1;
    var g = $X('<rect element-row="' + row + '" class="stripe ' + (row % 2 == 0 ? 'even' : 'odd') + '" x="0" y="' + String(row * self.height + self.height_shift / 2) + '" width="' + (self.width * maxcol + self.width - self.width_shift) + '" height="' + (self.height) + '" xmlns="http://www.w3.org/2000/svg"></rect>');
    self.svg.container.prepend(g);
    return g;
  } // }}}

  var draw_label = this.draw.draw_label = function (tname, id, label, row, col, group) { // {{{
    var g = $X('<text class="label" transform="translate(' + String(col * self.width - self.width_shift) + ',' + String(row * self.height + 20 - (self.height - self.height_shift)) + ')" xmlns="http://www.w3.org/2000/svg"></text>');
    var spli = $(label.split(/\n/));
    spli.each(function (k, v) {
      var tspan = $X('<tspan x="100" dy="' + (spli.length > 1 ? '-7' : '0') + '" xmlns="http://www.w3.org/2000/svg"></tspan>');
      if (k == 0) {
        tspan.text(v);
      } else {
        tspan.text(v);
        tspan.attr('dy', '15');
        tspan.attr('dx', '15');
      }
      g.append(tspan);
    });
    if (group) { group.find('g.element[element-id=' + id + ']').append(g); }
    else { self.svg.container.append(g); }
    return g;
  } // }}}


  var draw_symbol = this.draw.draw_symbol = function (columnWidths, sname, id, title, row, col, group, addition) { // {{{

    if (self.elements[sname] == undefined || self.elements[sname].svg == undefined) sname = 'unknown';
    let wshift = 0;
    const width = columnWidths[col]?.[row]?.width || 0;

    if (col === 1) {
      wshift = ((columnWidths[1]?.[0]?.width || 0) - width) / 2;
    } else {
      const columnwidth = columnWidths[col][row].minblock === 0
        ? (columnWidths[col][row].maxBlockHistory.length > 2
          ? columnWidths[col][row].maxBlockHistory[columnWidths[col][row].maxBlockHistory.length-2]
          : columnWidths[col][row].block)
        : columnWidths[col][row].minblock;

        if(col == 2 && row == 5){
          console.log(columnwidth)
        }


      let widthGap = columnwidth - width;
      if (columnWidths[col][row].alternative) {
        widthGap = columnwidth;
      }

      let previousBlockSum = 0;

      for (let prevCol = 1; prevCol < col; prevCol++) {
        const currentBlockmax = columnWidths[prevCol]?.[row]?.block ?? 0;

        previousBlockSum += currentBlockmax;
      }

      wshift = previousBlockSum + widthGap / 2 + columnWidths[col][row].offset;

    }
    if (addition) {
      var g = $X('<g class="element" element-type="' + sname + '" element-id="' + id + '" xmlns="http://www.w3.org/2000/svg">' +
        '<g transform="translate(' + String(col * self.width - self.width_shift + wshift) + ',' + String(row * self.height - (self.height - self.height_shift)) + ')"></g>' +
        '</g>');

    } else {
      var g = $X('<g class="element" element-type="' + sname + '" element-id="' + id + '" xmlns="http://www.w3.org/2000/svg">' +
        '<g transform="translate(' + String(col * self.width - self.width_shift + wshift) + ',' + String(row * self.height - (self.height - self.height_shift)) + ')">' +
        '<text class="super" transform="translate(30,8.4)">' +
        '<tspan class="active">0</tspan>' +
        '<tspan class="colon">,</tspan>' +
        '<tspan class="vote">0</tspan>' +
        '</text>' +
        '</g>' +
        '</g>');

    }

    var sym = self.svg.defs[sname].clone();
    console.log(sname)

    var tit = $X('<title xmlns="http://www.w3.org/2000/svg"></title>');
    tit.text(title);

    let trimmedText = title ? splitLabel(title) : ""; // 已裁剪文本

    sym.prepend(tit);
    sym.attr('class', 'activities');
   

    if (!trimmedText.includes(" ")) {
      sym.find('#label1').text(trimmedText);
      sym.find('#label1').attr('y', 20);
    } else {
      // 多个单词，拆分成两行
      let { line1, line2 } = distributeWordsIntoLines(trimmedText);

      sym.find('#label1').text(line1.join(" "));
      sym.find('#label2').text(line2.join(" "));
    }

    sym.find('#label').text(title);
    sym.find('#up').attr('d', 'M25,1 H' + (width + 28));
    sym.find('#bottom').attr('d', 'M25,29 H' + (width + 28));
    sym.find('#back').attr('width', width + 6);
    sym.find('#end').attr('transform', 'translate(' + (width + 23) + ', 0)');


    const parallelElement = sym.find('#parallel');

    if (parallelElement.length && columnWidths[col + 1] && columnWidths[col + 1][row] !== undefined) {
      parallelElement.attr('transform', 'translate(' + columnWidths[col + 1][row].minblock / 2 + ', 0)');
    }


    $(g[0].childNodes[0]).append(sym);

    // Binding events for symbol
    bind_event(g, sname, true);

    if (group) { group.append(g); }
    else { self.svg.container.children('g:first').append(g); }

    return g;
  } // }}}

  var bind_event = this.draw.bind_event = function (sym, tname, context) { //{{{
    for (event_name in adaptor.elements[tname]) {
      sym.bind(event_name, { 'function_call': adaptor.elements[tname][event_name] }, function (e) { e.data.function_call($(this).attr('element-id'), e) });
      if (event_name == 'mousedown') sym.bind('contextmenu', false);
    }
  } //}}}

  var draw_border = this.draw.draw_border = function (columnWidths, id, p1, p2, group) { // {{{范围的虚线边框
    let wshift1;
    if (p1.col === 1) {
      wshift1 = (columnWidths[1][0]?.width || 0) / 2 - (columnWidths[1][p1.row]?.minblock || 0) / 2;
    } else {
      let sumBlocks = 0;

      for (let col = 2; col < p1.col; col++) {
        sumBlocks += columnWidths[col]?.[p1.row]?.block || 0;
      }


      let current = columnWidths[p1.col]?.[p1.row]?.minblock === 0
        ? (columnWidths[p1.col][p1.row].maxBlockHistory.length > 2
          ? columnWidths[p1.col][p1.row].maxBlockHistory[columnWidths[p1.col][p1.row].maxBlockHistory.length-2]
          : columnWidths[p1.col][p1.row].block) / 2
        : 0;

      wshift1 =
        (columnWidths[1][0]?.width || 0) / 2 +
        (columnWidths[1][p1.row]?.block || 0) / 2 +
        sumBlocks +
        current +
        (columnWidths[p1.col]?.[p1.row]?.offset || 0);
    }

    let wshift2 = 0;

    const startCol = columnWidths[p1.col][p1.row].minblock === 0 ? p1.col + 1 : p1.col;

    //indentation
    if (columnWidths[p1.col][p1.row].minblock === 0 && p1.col != p2.col) {
      if (columnWidths[p1.col][p1.row].maxBlockHistory.length > 2) {
        wshift2 += columnWidths[p1.col][p2.row].maxBlockHistory[columnWidths[p1.col][p2.row].maxBlockHistory.length-2] / 2;
      }
      else {
        wshift2 += columnWidths[p1.col][p2.row].block / 2;
      }
    }


    for (let col = startCol; col < p2.col; col++) {
      wshift2 += columnWidths[col]?.[p2.row]?.block || 0;
    }


    let lastcol = -Infinity;
    for (let row = p1.row; row <= p2.row; row++) {
      let cell = columnWidths[p2.col]?.[row];
      if (cell?.symbol) {
        if (cell.alternative) {
          lastcol = Math.max(lastcol, cell.offset - (columnWidths[p1.col]?.[p1.row]?.offset || 0));
        }
        else {
          lastcol = Math.max(lastcol, cell.width + cell.offset - (columnWidths[p1.col]?.[p1.row]?.offset || 0));

        }
      }
    }

    wshift2 += lastcol;

    group.prepend($X('<rect element-id="' + id + '" x="' + ((p1.col - 0.50) * self.width + wshift1) + '" ' +
      'y="' + (p1.row - 0.80) * self.height + '" ' +
      'width="' + (((p2.col + 1.00) - p1.col) * self.width + wshift2 + 7) + '" ' +
      'height="' + ((p2.row + 1.00) - p1.row) * self.height + '" ' +
      'class="block" rx="15" ry="15" xmlns="http://www.w3.org/2000/svg"/>'));
  } // }}}

  var draw_tile = this.draw.draw_tile = function (columnWidths, id, p1, p2, group) { // {{{鼠标点上去后显示的框架

    let wshift1;
    if (p1.col === 1) {
      wshift1 = (columnWidths[1][0]?.width || 0) / 2 - (columnWidths[1][p1.row]?.minblock || 0) / 2;
    } else {
      let sumBlocks = 0;

      for (let col = 2; col < p1.col; col++) {
        sumBlocks += columnWidths[col]?.[p1.row]?.block || 0;
      }


      let current = columnWidths[p1.col]?.[p1.row]?.minblock === 0
        ? (columnWidths[p1.col][p1.row].maxBlockHistory.length > 2
          ? columnWidths[p1.col][p1.row].maxBlockHistory[columnWidths[p1.col][p1.row].maxBlockHistory.length-2]
          : columnWidths[p1.col][p1.row].block) / 2
        : 0;

      wshift1 =
        (columnWidths[1][0]?.width || 0) / 2 +
        (columnWidths[1][p1.row]?.block || 0) / 2 +
        sumBlocks +
        current +
        (columnWidths[p1.col]?.[p1.row]?.offset || 0);
    }

    let wshift2 = 0;

    const startCol = columnWidths[p1.col][p1.row].minblock === 0 ? p1.col + 1 : p1.col;

    //indentation
    if (columnWidths[p1.col][p1.row].minblock === 0 && p1.col != p2.col) {
      if (columnWidths[p1.col][p1.row].maxBlockHistory.length > 2) {
        wshift2 += columnWidths[p1.col][p2.row].maxBlockHistory[columnWidths[p1.col][p2.row].maxBlockHistory.length-2] / 2;
      }
      else {
        wshift2 += columnWidths[p1.col][p2.row].block / 2;
      }
    }


    for (let col = startCol; col < p2.col; col++) {
      wshift2 += columnWidths[col]?.[p2.row]?.block || 0;
    }


    let lastcol = -Infinity;
    for (let row = p1.row; row <= p2.row; row++) {
      let cell = columnWidths[p2.col]?.[row];
      if (cell?.symbol) {
        if (cell.alternative) {
          lastcol = Math.max(lastcol, cell.offset - (columnWidths[p1.col]?.[p1.row]?.offset || 0));
        }
        else {
          lastcol = Math.max(lastcol, cell.width + cell.offset - (columnWidths[p1.col]?.[p1.row]?.offset || 0));

        }
      }
    }

    wshift2 += lastcol;

    group.prepend($X('<rect element-id="' + id + '" x="' + ((p1.col - 1) * self.width + 1.3 * self.width_shift + wshift1) + '" ' +
      'y="' + ((p1.row - 1) * self.height + self.height_shift / 2) + '" ' +
      'width="' + (((p2.col + 1) - p1.col) * self.width + wshift2 + 7) + '" ' +
      'height="' + ((p2.row + 1) - p1.row) * self.height + '" ' +
      'class="tile" rx="15" ry="15" xmlns="http://www.w3.org/2000/svg"/>'));
  } // }}}


  var draw_connection = this.draw.draw_connection = function (columnWidths, group, start, end, max_line, num_lines, arrow) { // {{{
    if (((end['row'] - start['row']) == 0) && ((end['col'] - start['col']) == 0)) return;

    var line;

    if (arrow)
      line = $X('<path xmlns="http://www.w3.org/2000/svg" class="ourline" marker-end="url(#arrow)"/>');
    else
      line = $X('<path xmlns="http://www.w3.org/2000/svg" class="ourline"/>');


    const computeWShift = (point) => {
      if (point['col'] === 1) {
        return columnWidths[1][0].width / 2;
      }

      const firstColWidth = columnWidths[1][0].width / 2 +
        (columnWidths[1][point['row']]?.block || 0) / 2;

      const intermediateWidth = Array.from({ length: point['col'] - 2 }, (_, i) =>
        columnWidths[i + 2]?.[point['row']]?.block || 0
      ).reduce((sum, block) => sum + block, 0);

      const currentCell = columnWidths[point['col']]?.[point['row']] || {};


      const currentColWidth =
        currentCell.minblock === 0
          ? ((currentCell.maxBlockHistory.length > 2
            ? currentCell.maxBlockHistory[currentCell.maxBlockHistory.length-2]
            : currentCell.block) / 2)
          : (currentCell.minblock / 2 || 0);

      const offset = currentCell.offset || 0;

      return firstColWidth + intermediateWidth + currentColWidth + offset;
    };


    const wshift1 = computeWShift(start);
    const wshift2 = computeWShift(end);

    if (end['row'] - start['row'] == 0 || end['col'] - start['col'] == 0) { // straight line

      line.attr("d", "M " + String(start['col'] * self.width + wshift1) + "," + String(start['row'] * self.height - 15) + " " +
        String(end['col'] * self.width + wshift1) + "," + String(end['row'] * self.height - 15)
      );


    } else if (end['row'] - start['row'] > 0) { // downwards
      if (end['col'] - start['col'] > 0) {// left - right
        if (self.compact) {

          line.attr("d", "M " + String(start['col'] * self.width + wshift1) + "," + String(start['row'] * self.height - 15) + " " +
            String(start['col'] * self.width + 14 + + wshift1) + "," + String((end['row'] - 1) * self.height) + " " + // first turn of hotizontal-line going away from node
            String(end['col'] * self.width + wshift2) + "," + String((end['row'] - 1) * self.height) + " " +
            String(end['col'] * self.width + wshift2) + "," + String(end['row'] * self.height - 15)
          );

        } else {
          line.attr("d", "M " + String(start['col'] * self.width + wshift1) + "," + String(start['row'] * self.height - 15) + " " +
            String(end['col'] * self.width + wshift2) + "," + String(start['row'] * self.height - 15) + " " +
            String(end['col'] * self.width + wshift2) + "," + String(end['row'] * self.height - 15)
          );
        }
      } else { // right - left
        line.attr("d", "M " + String(start['col'] * self.width + wshift1) + "," + String(start['row'] * self.height - 15) + " " +
          String(start['col'] * self.width + wshift1) + "," + String(end['row'] * self.height - 35) + " " +
          String(end['col'] * self.width + 14 + wshift2) + "," + String(end['row'] * self.height - 35) + " " + // last turn of horizontal-line going into the node
          String(end['col'] * self.width + wshift2) + "," + String(end['row'] * self.height - 15)
        );
      }
    } else if (end['row'] - start['row'] < 0) { // upwards
      if (num_lines > 1) {// ??? no idea
        line.attr("d", "M " + String(start['col'] * self.width + wshift1) + "," + String(start['row'] * self.height - 15) + " " +
          String(start['col'] * self.width + wshift1) + "," + String((max_line - 1) * self.height + 5) + " " +
          String(end['col'] * self.width + 20 + wshift2) + "," + String((max_line - 1) * self.height + 5) + " " +
          String(end['col'] * self.width + 20 + wshift2) + "," + String(end['row'] * self.height + 25) + " " +
          String(end['col'] * self.width + wshift2) + "," + String(end['row'] * self.height - 15)
        );
      } else {
        line.attr("d", "M " + String(start['col'] * self.width + wshift1) + "," + String(start['row'] * self.height - 15) + " " +
          String(end['col'] * self.width + 15 + wshift2) + "," + String(start['row'] * self.height - 15) + " " +
          String(end['col'] * self.width + 15 + wshift2) + "," + String(end['row'] * self.height + 15) + " " +
          String(end['col'] * self.width + wshift2) + "," + String(end['row'] * self.height - 15)
        );
      }
    }
    self.svg.container.append(line);
  }//  }}}
  // }}}
  // Initialize {{{
  adaptor = wf_adaptor;
  // }}}
} // }}}

// WfDescription:
// Manages the description. It is further able to add/remove elements from the controlflow description.
function WfDescription(wf_adaptor, wf_illustrator) { // Model {{{
  // public variables
  this.elements = {}; // the rngs
  this.source = null;
  // private variables
  var self = this;
  var adaptor;
  var illustrator;
  var description;
  var id_counter = {};
  var update_illustrator = true;
  var labels = [];
  var columnWidths = [];
  var blocks = [];

  // Set Labels //{{{
  this.set_labels = function (graph) {
    if (illustrator.striped == true && illustrator.compact == false) {
      for (var i = 0; i < graph.max.row; i++) {
        illustrator.draw.draw_stripe(i, graph.max.col);
      }
    }
    if (illustrator.compact == false) {

      adaptor.draw_labels(graph.max, labels, illustrator.height_shift, illustrator.striped == true ? true : false);
    } else {
      adaptor.draw_labels(graph.max, [], illustrator.height_shift, false);
    }

    if (illustrator.compact == false) {

      if (labels.length > 0) {

        for (const [key, a] of Object.entries(labels)) {
          if (a.label && a.label[0] && a.label[0].column == 'Label' && a.label[0].value) {
            illustrator.draw.draw_label(a.tname, a.element_id, a.label[0].value, a.row, graph.max.col + 1, graph.svg);
          }
        };
      }
    }
  } //}}}

  // Generic Functions {{{
  this.set_description = function (desc, auto_update) { // public {{{
    if (auto_update != undefined) update_illustrator = auto_update;
    if (typeof desc == "string") {
      description = $($.parseXML(desc));
    } else if (desc instanceof jQuery) {
      description = desc;
    } else {
      alert("WfDescription: unknown description type:\nConstructor-Name: " + desc.constructor + " / TypeOf: " + (typeof desc));
      description = null;
    }
    id_counter = {};
    labels = [];
    illustrator.clear();

    calculateSymbolGrid(description.children('description').get(0), { 'row': 0, 'col': 0, final: false, wide: false });
    adjustColumnWidths();
    console.log(blocks);
    console.log(columnWidths);
    var graph = parse(description.children('description').get(0), { 'row': 0, 'col': 0, final: false, wide: false });
    let totalWidth = 0;

    for (let i = 1; i < columnWidths.length; i++) {
      totalWidth += columnWidths[i][0].width;
    }

    illustrator.set_svg(graph, totalWidth);
    self.set_labels(graph);


  } // }}}

  function adjustColumnWidths() {
    //Sort blocks by area (small to large), followed by column position (left to right).
    blocks.sort((a, b) => {
      const singleColDiff = (a.col1 === a.col2) - (b.col1 === b.col2);
      if (singleColDiff !== 0) return singleColDiff;
      return (a.col2 - a.col1) * (a.row2 - a.row1) - (b.col2 - b.col1) * (b.row2 - b.row1) ||
        a.col1 - b.col1 ||
        a.row1 - b.row1;
    });

    for (let i = blocks.length - 1; i >= 0; i--) {//store minblock and block 
      const Block = blocks[i];
      const { row1, col1, row2, col2 } = Block;

      for (let col = col1; col <= col2; col++) {
        if (!columnWidths[col]) continue; // 


        let maxBlock = 0;
        let block = 0;
        for (let row = row1; row <= row2; row++) {
          if (columnWidths[col][row] && columnWidths[col][row].minblock !== undefined) {
            if (!columnWidths[col][row].alternative) {
              block = Math.max(block, columnWidths[col][row].width);
            }
            maxBlock = Math.max(maxBlock, columnWidths[col][row].width);

          }
        }
        if (maxBlock != block) {
          maxBlock = (maxBlock - block) / 2 + block;
        }

        for (let row = row1; row <= row2; row++) {
          if (!columnWidths[col][row]) {
            columnWidths[col][row] = {
              block: maxBlock,
              minblock: block,
              width: 0,
              offset: 0,
              symbol: false,
              maxBlockHistory: [block], //Store the minblock of all block structures containing this symbol to find the second-to-last block,
                                        //  which will be used to calculate the final position.
              blocks: [i] //Store all block structures containing this symbol
            };
          }
          else {

            columnWidths[col][row].block = Math.max(columnWidths[col][row].block || 0, maxBlock);
            columnWidths[col][row].minblock = block;
            if (!columnWidths[col][row].maxBlockHistory) {
              columnWidths[col][row].maxBlockHistory = [];
            }
            if (!columnWidths[col][row].blocks) {
              columnWidths[col][row].blocks = [];
            }
            columnWidths[col][row].maxBlockHistory.push(block);
            columnWidths[col][row].blocks.push(i);

          }

        }
      }
    }

    if (columnWidths[1]) {
      var Col1 = columnWidths[1];
      var max1 = Col1[0]?.width || 0;

      for (let i = 0; i < Col1.length; i++) {
        if (!Col1[i]) {
          Col1[i] = { block: max1, minblock: 0, width: 0, offset: 0, symbol: false, alternative: false }; // 初始化
        } else {
          Col1[i].block = max1;
        }
      }
    } else {
      console.error("columnWidths[1] is undefined");
    }

    //Here calculates the offset generated by a gateway or loop.
    const changes = new Map();

    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];


      if (!block.branch) {//gateway/loop or not
        continue;
      }

      let offsetValue = columnWidths[block.col1]?.[block.row1]
        ? (columnWidths[block.col1][block.row1].maxBlockHistory.length > 2
          ? columnWidths[block.col1][block.row1].maxBlockHistory[1] // 直接取值
          : columnWidths[block.col1][block.row1].block) / 2
        : 0; //calculate the value of offset

      let maxContainedBy = columnWidths[block.col1]?.[block.row1]?.blocks[0]; //index of maxblock

      for (let row = block.row1; row <= block.row2; row++) {//Modify the offset of each symbol inside the gateway or loop structure, except for those in the first column.
        if (offsetValue !== undefined) {
          for (let col = block.col1 + 1; col <= block.col2; col++) {
            if (columnWidths[col]?.[row]) {
              columnWidths[col][row].offset = (columnWidths[col][row].offset ?? 0) - offsetValue;
              columnWidths[col][row].branchoffset = - offsetValue;
            }
          }
        }
      }


      let maxblock = blocks[maxContainedBy];//maxblock

      if (block.col2 == maxblock.col2) continue;

      //Check if there are any other affected symbols on 
      //the right side of this gateway/loop structure.
      for (let row = block.row1; row <= block.row2; row++) {
      


        if (columnWidths[block.col2]?.[row]?.width >= columnWidths[block.col2]?.[row]?.block) {

          let foundMatchingBlock = false;


          for (let r = maxblock.row1; r <= maxblock.row2; r++) {
            if (columnWidths[block.col2 + 1]?.[r]?.symbol === true) {

              for (let j = 0; j < blocks.length; j++) {
                if (i === j) continue;
                const blockb = blocks[j];


                if (
                  blockb.col1 <= block.col2 + 1 && blockb.col2 >= block.col2 + 1 &&
                  blockb.row1 <= r && blockb.row2 >= r
                ) {

                  if (blockb.col1 === block.col1) {
                    foundMatchingBlock = true;
                    break;
                  }
                }
              }

              if (foundMatchingBlock) break;
            }
          }

          if (!foundMatchingBlock) {
            if (!changes.has(maxContainedBy)) { 
              changes.set(maxContainedBy, new Set());
            }
            changes.get(maxContainedBy).add(block.col2);
          }
          break;
        }
      }

    }

    for (const [blockIndex, changedCols] of changes.entries()) {
      const block = blocks[blockIndex];

      if (!block) continue;

      for (const col of changedCols) {
        let maxWidth = 0;


        for (let row = block.row1; row <= block.row2; row++) {
          if (columnWidths[col]?.[row]) {
            const widthWithOffset = columnWidths[col][row].width + (columnWidths[col][row].branchoffset ?? 0);
            maxWidth = Math.max(maxWidth, widthWithOffset);
          }
        }
        const blockMax = columnWidths[col]?.[0]?.width ?? 0;
        const offsetDifference = blockMax - maxWidth;

        if (offsetDifference > 0) {

          for (let row = block.row1; row <= block.row2; row++) {
            if (columnWidths[col]?.[row]) {
              columnWidths[col][row].block -= offsetDifference;

            }
          }

        }
      }
    }
  }

  var gd = this.get_description = function () { //  public {{{
    var serxml = $(description.get(0).documentElement).clone(true);
    serxml.removeAttr('svg-id');
    serxml.removeAttr('svg-type');
    serxml.removeAttr('svg-subtype');
    serxml.removeAttr('svg-label');
    $('*[svg-id]', serxml).each(function () {
      $(this).removeAttr('svg-id');
    });
    $('*[svg-type]', serxml).each(function () {
      $(this).removeAttr('svg-type');
    });
    $('*[svg-subtype]', serxml).each(function () {
      $(this).removeAttr('svg-subtype');
    });
    $('*[svg-label]', serxml).each(function () {
      $(this).removeAttr('svg-label');
    });
    return serxml.serializeXML();
  } // }}}
  this.get_node_by_svg_id = function (svg_id) { // {{{
    return $('[svg-id = \'' + svg_id + '\']', description);
  } // }}}
  var context_eval = this.context_eval = function (what) { // {{{
    return eval(what);
  } // }}}
  var get_free_id = this.get_free_id = function (other) { // {{{
    var existing = new Array();
    if (other) {
      if ($(other).attr('id')) {
        existing.push($(other).attr('id'));
      }
      $(other).find("[id]").each(function (k, v) {
        existing.push($(v).attr('id'));
      });
    }
    $('*[id]', description).each(function () { existing.push($(this).attr('id')) });
    var id = 1;
    while ($.inArray('a' + id, existing) != -1) {
      id += 1;
    }
    return 'a' + id;
  } // }}}
  var refresh = this.refresh = function (doit) {
    id_counter = {};
    labels = [];
    illustrator.clear();
    var graph = parse(description.children('description').get(0), { 'row': 0, 'col': 0 });
    illustrator.set_svg(graph, 0);
    // set labels
    self.set_labels(graph);

    doit(self);
  }
  var update = this.update = function (svgid) { // {{{
    id_counter = {};
    if (update_illustrator) {
      labels = [];
      illustrator.clear();

      var graph = parse(description.children('description').get(0), { 'row': 0, 'col': 0 });
      illustrator.set_svg(graph, 0);
      self.set_labels(graph);
    }

    var newn = $('*[new=true]', description);
    newn.removeAttr('new');

    if (newn.attr('svg-id') != undefined)
      adaptor.notify(newn.attr('svg-id'));
    else if (svgid != undefined)
      adaptor.notify(svgid);
    else if (newn.parent('[svg-id]').length > 0)
      adaptor.notify(newn.parent('[svg-id]').attr('svg-id'));
    else
      console.info('Something went horribly wrong');
  } // }}}
  // }}}
  // Adaption functions {{{
  this.insert_after = function (new_node, target, source_opts) { // {{{
    if ($.isArray(new_node)) {
      $.each(new_node, function (k, v) {
        var nn = self.source(v, source_opts);
        target.after(nn);
        nn.attr('new', 'true');
      });
    } else {
      var nn = self.source(new_node, source_opts);
      target.after(nn);
      nn.attr('new', 'true');
    }
    update();
  } // }}}
  this.insert_first_into = function (new_node, target, source_opts) { // {{{
    if ($.isArray(new_node)) {
      $.each(new_node, function (k, v) {
        var nn = self.source(v, source_opts);
        target.prepend(nn);
        nn.attr('new', 'true');
      });
    } else {
      var nn = self.source(new_node, source_opts);
      target.prepend(nn);
      nn.attr('new', 'true');
    }
    update();
  } // }}}
  this.insert_last_into = function (new_node, target) { // {{{
    if ($.isArray(new_node)) {
      $.each(new_node, function (k, v) {
        var nn = self.source(v);
        target.append(nn);
        nn.attr('new', 'true');
      });
    } else {
      var nn = self.source(new_node);
      target.append(nn);
      nn.attr('new', 'true');
    }
    update();
  } // }}}
  this.remove = function (selector, target) {//{{{
    var svgid;
    if (selector == undefined) {
      svgid = target.attr('svg-id');
      target.remove()
    } else {
      svgid = $(selector, target).attr('svg-id');
      if (!svgid) {
        svgid = target.attr('svg-id');
      }
      $(selector, target).remove();
    }
    update(svgid);
  }
  // }}}
  // }}}
  // Helper Functions {{{
  var insert = function (row, col, width, alternative) {//把label的宽度插入到表格中
    if (!columnWidths[col]) {
      columnWidths[col] = [];
    }
    //symbol: Whether it's a real symbol, or just a blank
    //alternative: alternative stucture, Its label is on the right side of the symbol, not in the middle, so 2✖️width is used in the length calculation
    if (!columnWidths[col][row]) {
      if (alternative) {
        columnWidths[col][row] = { block: 0, minblock: 0, width: width, offset: 0, symbol: true, alternative: alternative };
      }
      else {
        columnWidths[col][row] = { block: width, minblock: width, width: width, offset: 0, symbol: true, alternative: alternative }; // 初始化为默认对象

      }
    }
    // 如果第 0 位不存在或宽度小于当前宽度，则更新第 0 位为当前最大宽度
    if (!columnWidths[col][0]) {
      columnWidths[col][0] = { block: 0, minblock: 0, width: 0, offset: 0, symbol: false, alternative: false };
    }

    columnWidths[col][0].width = Math.max(columnWidths[col][0].width, width);

    return columnWidths;
  };


  var calculateSymbolGrid = function (root, parent_pos) {

    var pos = jQuery.extend(true, {}, parent_pos);//创建对象的深拷贝   { 'row': 0, 'col': 0, final: false, wide: false }
    var max = { 'row': 0, 'col': 0 };
    var endnodes = [];

    var root_expansion = illustrator.elements[root.tagName].expansion(root);
    //horizontal vertical
    var block = { 'max': {} }; // e.g. {'max':{'row':0,'col':0}, 'endpoints':[]};
    if (root_expansion == 'horizontal') pos.row++;
    if (illustrator.elements[root.tagName].col_shift(root) == true && root_expansion != 'horizontal') pos.col++;

    if (root.tagName == 'description') { // First parsing 
      pos.row++;
      this.columnWidths = insert(columnWidths, pos.row, pos.col, 0);
    }

    $(root).children().filter(function () { return this.localName[0] != '_'; }).each(function () {

      var context = this;
      var tname = context.tagName;

      var sname = sym_name(tname, context);

      pos.final = illustrator.elements[sname].final ? true : false;
      pos.wide = illustrator.elements[sname].wide ? true : false;

      // Calculate next position {{{
      if (root_expansion == 'vertical') pos.row++;
      if (root_expansion == 'horizontal') {
        pos.col++;

        if (!illustrator.compact) {
          if (block.max.row) {
            pos.row = block.max.row + 1;
          }
        }
      }

      if (illustrator.elements[tname] != undefined && illustrator.elements[tname].type == 'complex') {

        if (illustrator.elements[tname] != undefined && !illustrator.elements[tname].svg) pos.row--;

        block = calculateSymbolGrid(context, jQuery.extend(true, {}, pos));

        var wide = (illustrator.elements[sname].wide == true && block.max.col == pos.col) ? pos.col + 1 : block.max.col;
        var p;
        var branch = false;
        if (illustrator.elements[sname].closing_symbol) {
          p = block.max.row + 2;
          branch = true; //gateway
        } else {
          p = block.max.row + 1;
        }

        if (context.tagName == "loop") {
          branch = true; //loop
        }

        const b = {
          row1: pos.row,
          col1: pos.col,
          row2: p - 1,
          col2: wide,
          branch: branch
        };
        blocks.push(b);


        if (illustrator.elements[sname].endnodes == 'aggregate') endnodes = []; // resets endpoints e.g. potential preceding primitive
      } else {
        if (illustrator.elements[tname] != undefined && illustrator.elements[tname].type == 'primitive' && illustrator.elements[tname].svg) { // This enables "invisble" elements, by returning undefined in the SVG function (e.g. constraints)
          block.max.row = pos.row;
          block.max.col = pos.col;
          block.endnodes = [pos];
        }
      }

      set_details(tname, sname, pos, context);

      if (illustrator.elements[sname] != undefined && illustrator.elements[sname].endnodes != 'this') {
        for (i in block.endnodes) { endnodes.push(block.endnodes[i]); } // collects all endpoints from different childs e.g. alternatives from choose
      } else { endnodes = [jQuery.extend(true, {}, pos)]; }
      let text = $(context).attr("svg-label");


      let trimmedText = text ? splitLabel(text) : ""; // 已裁剪文本

      let width;
      if (!trimmedText.includes(" ")) {
        // only one word
        width = getTextWidth(trimmedText, "label");
      } else {
        // multiple words
        let { line1, line2 } = distributeWordsIntoLines(trimmedText);
        let width1 = getTextWidth(line1.join(" "), "label");
        let width2 = getTextWidth(line2.join(" "), "label");

        width = Math.max(width1, width2); // select the longest
      }

      if (sname == "loop_head" || sname == "choose_inclusive" || sname == "choose_exclusive") {
        this.columnWidths = insert(pos.row, pos.col, 0, false);

      }//|| sname == "alternative"
      else if (sname == "alternative") {
        console.log(width);
        this.columnWidths = insert(pos.row, pos.col, 2 * width, true);
      }
      else {

        this.columnWidths = insert(pos.row, pos.col, width, false);

      }

      if (root_expansion == 'vertical') { prev = jQuery.extend(true, {}, endnodes); pos.row = block.max.row; } // covers e.g. input's for alternative, parallel_branch, ... everything with horizontal expansion
      if (root_expansion == 'horizontal') pos.col = block.max.col;

      if (max.row < block.max.row) max.row = block.max.row;
      if (max.col < block.max.col) max.col = block.max.col;
      // }}}

      if (illustrator.elements[sname].closing_symbol) {
        var ctname = illustrator.elements[sname].closing_symbol;

        var csname = sym_name(ctname, context);
        pos.row++;
        max.row++;
        block.max.row = pos.row;
        if (illustrator.elements[sname].endnodes == 'this') {
          pos.col++;
          if (pos.col > max.col) {
            max.col++;
            block.max.col = pos.col;
          }
          this.columnWidths = insert(pos.row, pos.col, 0);
          pos.col--;
        } else {
          this.columnWidths = insert(pos.row, pos.col, 0);
        }
        set_details(ctname, csname, pos, context, true);

        prev = jQuery.extend(true, {}, endnodes);
      }
    });

    if ($(root).children().filter(function () { return this.attributes['svg-id'] != undefined; }).length == 0) { // empty complex found
      endnodes = [parent_pos];
      max.row = parent_pos.row;
      max.col = parent_pos.col;
    }

    if (root.tagName == 'description' && illustrator.elements[root.tagName].closing_symbol) {
      pos.row++;
      max.row = pos.row;
    }

    return { 'endnodes': endnodes, 'max': max };
  }


  var parse = function (root, parent_pos) { // private {{{  description.children('description').get(0), {'row':0,'col':0,final:false,wide:false}

    var pos = jQuery.extend(true, {}, parent_pos);//创建对象的深拷贝   { 'row': 0, 'col': 0, final: false, wide: false }
    var max = { 'row': 0, 'col': 0 };
    var prev = [parent_pos]; // connects parent with child(s), depending on the expansion
    var endnodes = [];
    var sname = sym_name(root.tagName, root);

    var root_expansion = illustrator.elements[root.tagName].expansion(root);
    //horizontal vertical
    var block = { 'max': {} }; // e.g. {'max':{'row':0,'col':0}, 'endpoints':[]};

    var group = $X('<g class="group" xmlns="http://www.w3.org/2000/svg"/>');

    if (root_expansion == 'horizontal') pos.row++;
    if (illustrator.elements[root.tagName].col_shift(root) == true && root_expansion != 'horizontal') pos.col++;

    if (root.tagName == 'description') { // First parsing 
      pos.row++;
      $(root).attr('svg-id', 'description');
      $(root).attr('svg-type', 'description');
      $(root).attr('svg-subtype', 'description');
      group.attr('element-id', 'group-description');

      if (illustrator.elements[sname].label) {
        // javascript object spread syntax is my new weird crush - the JS designers must be serious people
        labels.push({ ...{ row: pos.row, element_id: 'start', tname: 'start', label: illustrator.elements[sname].label(root) }, ...illustrator.draw.get_y(pos.row) });
      }

      illustrator.draw.draw_symbol(columnWidths, sname, 'description', 'START', pos.row, pos.col, group);


    } // }}}

    $(root).children().filter(function () { return this.localName[0] != '_'; }).each(function () {

      var context = this;
      var tname = context.tagName;

      var sname = sym_name(tname, context);

      pos.final = illustrator.elements[sname].final ? true : false;
      pos.wide = illustrator.elements[sname].wide ? true : false;

      // Calculate next position {{{

      if (root_expansion == 'vertical') pos.row++;

      if (root_expansion == 'horizontal') {//水平
        pos.col++;

        if (!illustrator.compact) {
          if (block.max.row) {
            pos.row = block.max.row + 1;
          }
        }
      }



      if (illustrator.elements[tname] != undefined && illustrator.elements[tname].type == 'complex') {
        if (illustrator.elements[tname] != undefined && !illustrator.elements[tname].svg) pos.row--;
        // TODO: Remaining problem is the order inside the svg. Thats why the connection is above the icon

        block = parse(context, jQuery.extend(true, {}, pos));


        group.append(block.svg);
        block.svg.attr('id', 'group-' + $(context).attr('svg-id'));



        if (illustrator.elements[sname].endnodes == 'aggregate') endnodes = []; // resets endpoints e.g. potential preceding primitive
      } else {

        if (illustrator.elements[tname] != undefined && illustrator.elements[tname].type == 'primitive' && illustrator.elements[tname].svg) { // This enables "invisble" elements, by returning undefined in the SVG function (e.g. constraints)
          block.max.row = pos.row;
          block.max.col = pos.col;
          block.endnodes = [pos];
          block.svg = group;
        }
      }

      var g;

      var origpos = jQuery.extend(true, {}, pos);
      //console.log(block);

      [g, endnodes] = draw_position(tname, origpos, prev, block, group, endnodes, context);


      if (root_expansion == 'vertical') { prev = jQuery.extend(true, {}, endnodes); pos.row = block.max.row; } // covers e.g. input's for alternative, parallel_branch, ... everything with horizontal expansion
      if (root_expansion == 'horizontal') pos.col = block.max.col;

      if (max.row < block.max.row) max.row = block.max.row;
      if (max.col < block.max.col) max.col = block.max.col;
      // }}}

      if (illustrator.elements[sname].closing_symbol) {
        var ctname = illustrator.elements[sname].closing_symbol;
        pos.row++;
        max.row++;
        block.max.row = pos.row;
        if (illustrator.elements[sname].endnodes == 'this') {
          pos.col++;
          if (pos.col > max.col) {
            max.col++;
            block.max.col = pos.col;
          }

          draw_position(ctname, pos, block.endnodes, block, group, [], context, { svg: g, pos: origpos });

          pos.col--;
        } else {

          [undefined, endnodes] = draw_position(ctname, pos, prev, block, group, [], context, { svg: g, pos: origpos });

        }
        prev = jQuery.extend(true, {}, endnodes);
      }
    });

    if ($(root).children().filter(function () { return this.attributes['svg-id'] != undefined; }).length == 0) { // empty complex found
      endnodes = [parent_pos];
      max.row = parent_pos.row;
      max.col = parent_pos.col;
    }

    if (root.tagName == 'description' && illustrator.elements[root.tagName].closing_symbol) {
      pos.row++;
      max.row = pos.row;

      draw_position(illustrator.elements['start'].closing_symbol, pos, prev, block, group, [], this, { svg: group, pos: pos });
    }

    return { 'endnodes': endnodes, 'max': max, 'svg': group };
  } // }}}



  var sym_name = function (tname, context) { //{{{
    var sname;
    if (!illustrator.elements[tname]) { sname = 'unknown'; }
    else if (typeof illustrator.elements[tname].resolve_symbol == 'function') { sname = illustrator.elements[tname].resolve_symbol(context, illustrator.elements[tname].col_shift ? illustrator.elements[tname].col_shift(context) : undefined); }
    else if (typeof illustrator.elements[tname].resolve_symbol == 'string') { sname = illustrator.elements[tname].resolve_symbol; }
    else { sname = tname; }
    if (sname == null) { sname = tname; }
    return sname;
  } //}}}



  var set_details = function (tname, sname, pos, context, simple) { //{{{

    if (simple == undefined || simple == false) {
      if ($(context).attr('id') == undefined) {
        if (id_counter[tname] == undefined) id_counter[tname] = -1;
        $(context).attr('svg-id', tname + '_' + (++id_counter[tname]));
      } else {
        $(context).attr('svg-id', $(context).attr('id'));
      }
    }

    if (illustrator.elements[sname].label) {
      var lab = illustrator.elements[sname].label(context);
      if (lab && lab[0] && lab[0].value && lab[0].column == 'Label' && lab[0].value != '') {
        $(context).attr('svg-label', lab[0].value);

      }


      labels.push({ ...{ row: pos.row, element_id: $(context).attr('svg-id'), tname: tname, label: lab }, ...illustrator.draw.get_y(pos.row) }); //这里加入了label

    }
  } //}}}
  var draw_position = function (tname, pos, prev, block, group, endnodes, context, second) { // private {{{
    var sname = sym_name(tname, context);


    // Draw Symbol {{{
    if (second) {

      illustrator.draw.draw_symbol(columnWidths, sname, $(context).attr('svg-id'), undefined, pos.row, pos.col, second.svg, true).addClass(illustrator.elements[sname] ? illustrator.elements[sname].type : 'primitive unknown');

    } else {

      $(context).attr('svg-type', tname);
      $(context).attr('svg-subtype', sname);
      if ((illustrator.elements[sname] && illustrator.elements[sname].svg) || sname == 'unknown') {

        var g = illustrator.draw.draw_symbol(columnWidths, sname, $(context).attr('svg-id'), $(context).attr('svg-label'), pos.row, pos.col, block.svg).addClass(illustrator.elements[sname] ? illustrator.elements[sname].type : 'primitive unknown');

        if (illustrator.elements[sname].info) {
          var info = illustrator.elements[sname].info(context);
          for (const [key, val] of Object.entries(info)) {
            g.attr(key, val);
          };
        }
      } else { console.log("no icon " + sname); }
      if (illustrator.elements[sname] && illustrator.elements[sname].border) {
        var wide = (illustrator.elements[sname].wide == true && block.max.col == pos.col) ? pos.col + 1 : block.max.col;
        if (illustrator.elements[sname].closing_symbol) {
          illustrator.draw.draw_border(columnWidths, $(context).attr('svg-id'), pos, { col: wide, row: block.max.row + 1 }, block.svg);
        } else {
          illustrator.draw.draw_border(columnWidths, $(context).attr('svg-id'), pos, { col: wide, row: block.max.row }, block.svg);
        }
      }
      if (illustrator.elements[sname] && illustrator.elements[sname].type == 'complex') {
        var wide = (illustrator.elements[sname].wide == true && block.max.col == pos.col) ? pos.col + 1 : block.max.col;
        if (illustrator.elements[sname].closing_symbol) {

          illustrator.draw.draw_tile(columnWidths, $(context).attr('svg-id'), pos, { col: wide, row: block.max.row + 1 }, block.svg);
        } else {

          illustrator.draw.draw_tile(columnWidths, $(context).attr('svg-id'), pos, { col: wide, row: block.max.row }, block.svg);

        }
      }
    }
    // }}}
    // Calculate Connection {{{
    if (illustrator.elements[sname] != undefined && illustrator.elements[sname].closeblock == true) { // Close Block if element e.g. loop
      if (second) {
        if (second.pos.row + 1 < pos.row) { // when no content, dont paint the up arrow
          illustrator.draw.draw_connection(columnWidths, group, pos, second.pos, block.max.row + 1, 1, true);

        }
      } else {
        for (node in block.endnodes) {
          if (!block.endnodes[node].final) {
            illustrator.draw.draw_connection(columnWidths, group, block.endnodes[node], pos, block.max.row + 1, block.endnodes.length, true);

          }
        }
      }
    }
    if (illustrator.elements[sname] != undefined && illustrator.elements[sname].endnodes != 'this') {
      for (i in block.endnodes) { endnodes.push(block.endnodes[i]); } // collects all endpoints from different childs e.g. alternatives from choose
    } else { endnodes = [jQuery.extend(true, {}, pos)]; } // sets this element as only endpoint (aggregate)

    if (prev[0].row == 0 || prev[0].col == 0) { // this enforces the connection from description to the first element
      illustrator.draw.draw_connection(columnWidths, group, { row: 1, col: 1 }, pos, null, null, true);
    } else {
      if (illustrator.elements[sname].noarrow == undefined || illustrator.elements[sname].noarrow == false) {
        for (node in prev) {
          if (!prev[node].final) {
            if (prev[node].wide) {
              var pn = jQuery.extend(true, {}, prev[node]);
              if (pos.col > prev[node].col) {
                pn.col = pos.col;
              }
              illustrator.draw.draw_connection(columnWidths, group, pn, pos, null, null, true);

            } else {
              illustrator.draw.draw_connection(columnWidths, group, prev[node], pos, null, null, true);

            }
          }
        }
      } else {
        for (node in prev) {
          if (!prev[node].final)
            illustrator.draw.draw_connection(columnWidths, group, prev[node], pos, null, null, false);

        }
      }
    }
    // }}}
    return [g, endnodes];
  } // }}}
  //  }}}

  //  Initialze {{{
  adaptor = wf_adaptor;
  illustrator = wf_illustrator;
  // }}}
} // }}}