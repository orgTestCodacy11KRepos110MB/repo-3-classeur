angular.module('classeur.extensions.markdownExtra', [])
	.directive('clMarkdownExtraSettings', function() {
		return {
			restrict: 'E',
			templateUrl: 'extensions/markdownExtra/markdownExtraSettings.html'
		};
	})
	.directive('clMarkdownExtra', function($window, clEditorSvc, clSettingSvc) {
		clSettingSvc.setDefaultValue('markdownExtra', true);

		var options = {
			extensions: [
				"fenced_code_gfm",
				"tables",
				"def_list",
				"attr_list",
				"footnotes",
				"smartypants",
				"strikethrough",
				"newlines"
			],
			intraword: true,
			toc: true,
			tocMaxDepth: 6,
			tocMarker: '\\[(TOC|toc)\\]',
			syntaxHighlighting: true
		};

		var previewElt;
		var tocRegExp = new RegExp("^\\s*" + options.tocMarker + "\\s*$");

		clEditorSvc.onInitConverter(50, function(converter) {
			var isEnabled = clSettingSvc.values.markdownExtra;

			function hasExtension(extensionName) {
				return isEnabled && options.extensions.some(function(extension) {
					return extension == extensionName;
				});
			}

			var converterOptions = {};
			if (isEnabled && options.intraword) {
				converterOptions = {
					_DoItalicsAndBold: function(text) {
						text = text.replace(/([^\w*]|^)(\*\*|__)(?=\S)(.+?[*_]*)(?=\S)\2(?=[^\w*]|$)/g, "$1<strong>$3</strong>");
						text = text.replace(/([^\w*]|^)(\*|_)(?=\S)(.+?)(?=\S)\2(?=[^\w*]|$)/g, "$1<em>$3</em>");
						// Redo bold to handle _**word**_
						text = text.replace(/([^\w*]|^)(\*\*|__)(?=\S)(.+?[*_]*)(?=\S)\2(?=[^\w*]|$)/g, "$1<strong>$3</strong>");
						return text;
					}
				};
			}
			converter.setOptions(converterOptions);

			if (isEnabled) {
				$window.Markdown.Extra.init(converter, {
					extensions: options.extensions,
					highlighter: 'prettify'
				});

				if (options.syntaxHighlighting) {
					clEditorSvc.onAsyncPreview(function(cb) {
						Array.prototype.forEach.call(document.querySelectorAll('.prettyprint > code'), function(elt) {
							!elt.highlighted && $window.Prism.highlightElement(elt);
							elt.highlighted = true;
						});
						cb();
					});
				}
			}

			// Add email conversion to links
			converter.hooks.chain("postConversion", function(text) {
				return text.replace(/<(mailto\:)?([^\s>]+@[^\s>]+\.\S+?)>/g, function(match, mailto, email) {
					return '<a href="mailto:' + email + '">' + email + '</a>';
				});
			});

			// Set editor options
			if (hasExtension('fenced_code_gfm')) {
				// Add new fenced code block delimiter with priority 25
				clEditorSvc.setSectionDelimiter(25, '^```[^`\\n]*\\n[\\s\\S]*?\\n```|');
			} else {
				// Unset fenced code block delimiter
				clEditorSvc.setSectionDelimiter(25, undefined);
			}
			clEditorSvc.setPrismOptions({
				fcbs: hasExtension('fenced_code_gfm'),
				tables: hasExtension('tables'),
				footnotes: hasExtension('footnotes'),
				strikes: hasExtension('strikethrough'),
				toc: isEnabled && options.toc
			});

			isEnabled && options.toc && clEditorSvc.onAsyncPreview(function(cb) {
				// Build the TOC
				var elementList = [];
				Array.prototype.forEach.call(previewElt.querySelectorAll('h1, h2, h3, h4, h5, h6'), function(elt) {
					elementList.push(new TocElement(elt.tagName, elt.id, elt.textContent));
				});
				elementList = groupTags(elementList);
				var htmlToc = '<div class="toc">\n<ul>\n' + elementList.join("") + '</ul>\n</div>\n';

				// Replace toc paragraphs
				Array.prototype.slice.call(previewElt.getElementsByTagName('p')).forEach(function(elt) {
					if (tocRegExp.test(elt.innerHTML)) {
						elt.innerHTML = htmlToc;
					}
				});

				cb();
			});
		});


		// TOC element description
		function TocElement(tagName, anchor, text) {
			this.tagName = tagName;
			this.anchor = anchor;
			this.text = text;
			this.children = [];
		}

		TocElement.prototype.childrenToString = function() {
			if (this.children.length === 0) {
				return "";
			}
			var result = "<ul>\n";
			this.children.forEach(function(child) {
				result += child.toString();
			});
			result += "</ul>\n";
			return result;
		};

		TocElement.prototype.toString = function() {
			var result = "<li>";
			if (this.anchor && this.text) {
				result += '<a href="#' + this.anchor + '">' + this.text + '</a>';
			}
			result += this.childrenToString() + "</li>\n";
			return result;
		};

		// Transform flat list of TocElement into a tree
		function groupTags(array, level) {
			level = level || 1;
			var tagName = "H" + level;
			var result = [];

			var currentElement;

			function pushCurrentElement() {
				if (currentElement.children.length > 0) {
					currentElement.children = groupTags(currentElement.children, level + 1);
				}
				result.push(currentElement);
			}

			array.forEach(function(element) {
				if (element.tagName != tagName) {
					if (level !== options.tocMaxDepth) {
						currentElement = currentElement || new TocElement();
						currentElement.children.push(element);
					}
				} else {
					currentElement && pushCurrentElement();
					currentElement = element;
				}
			});
			currentElement && pushCurrentElement();
			return result;
		}

		return {
			restrict: 'A',
			link: function(scope, element) {
				previewElt = element[0];

				scope.$watch('settingSvc.values.markdownExtra', function() {
					clEditorSvc.initConverter();
				});
			}
		};
	});