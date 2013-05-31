/**
 * This improved focus-event which you can bind to your elements will tell
 * you who triggered the focus. Depending on the value of event.responsible the event came from:
 *
 * a) Manual:	value = 0 or $.focusFrom.manual	-	The programmer triggered it manually.
 * b) Mouse:	value = 1 or $.focusFrom.mouse
 * c) Keyboard:	value = 2 or $.focusFrom.keyboard
 *
 * Usage: Instead of binding "focus" or "focusin", bind "iFocus" or "iFocusin".
 * The value is stored in jQuery.Event.focusFrom
 *
 * @version 1.0.0
 * @license GPL 3.0 http://www.gnu.org/licenses/gpl-3.0.html
 * @copyright Mazdak Farrokhzad <twingoow@gmail.com>
 */
(function($) {
	// "Constants" for ease of use.
	$.focusFrom	= {
		manual: 0,
		mouse: 1,
		keyboard: 2
	};

	function init( elem, state ) {

		function onMousedown() {
			// Only set the data attribute if it's not already focused, as the
			// focus event wouldn't fire afterwards, leaving the flag set.
			if ( !$( this ).is( ":focus" ) ) {
				$( this ).data( "focusFromMouse", true );
			}
		}

		// If we just pass elem, then jQuery will bug.
		$( elem === document ? document.documentElement : elem )[state ? "bind" : "unbind"]( "mousedown", onMousedown ); 

		return true;
	}

	$.each( { focus: "iFocus", focusin: "iFocusin" }, function( orig, fix ) {

		$.event.special[fix] = {
			setup: function() {
				return init( this, true );
			},
			teardown: function() {
				return init( this, false );
			},
			add: function( obj ) {

				obj.focusHandler = function( event ) {

					if ( !event.hasOwnProperty("originalEvent") ) {
						// It was not issued by client.
						event.focusFrom = $.focusFrom.manual;
					} else {
						// From mouse or keyboard?
						var $this = $( this );
						event.focusFrom = $this.data( "focusFromMouse" ) === true ? $.focusFrom.mouse : $.focusFrom.keyboard;
						$this.removeData( "focusFromMouse" );
					}

					return obj.handler.apply( this, arguments );
				};

				$(this).bind( orig, obj.data, obj.focusHandler );
			},
			remove: function( obj ) {
				$( this ).unbind( orig, obj.focusHandler );
			}
		};
	});
})(jQuery);

/**
 * Copies some or all attributes of one element to another.
 *
 * @param jQuery|Element source An element to copy attributes from.
 * @param string attrs optional list of attributes to copy (if not passed, all attributes are used).
 * @param object filters optional list of filters by attr-keys.
 * @returns jQuery
 */
(function($) {
	jQuery.fn.attrsFrom = function( source, attrs, filters ) {
		// Normalize source argument.
		source = jQuery( source );

		var list = {}, add = function( val, key ) {
			list[key] = (val = source.attr( key )) && filters && key in filters ? (val = filters[key].call( val, val, key )) : val;
		};

		// If attrs is passed, assume a ws-separated string, otherwise use all attributes present.
		attrs ? jQuery.each( attrs.split( " " ), add ) : jQuery.each( source[0].attributes, function( val, key ) { add( val, key.name ) });

		return jQuery( this ).attr( list );
	};
})(jQuery);

/**
 * This plugin allows for circumstancial hooks/callbacks talior-made for:
 * $.val( ... ), $.attr( ... ), $.prop( ...), $.css( ... ) or
 * - in theory - any mechanism that needs circumstancial hooks.
 *
 * The circumstance or "predicate" can be a string (selector) passed to elem.is(...) or a function that returns true.
 * It uses the same predicate for both get/set events.
 *
 * @example $.hooksManager.val.register( 'div', '.myPluginClass', {
 *		get: function( elem ) { return $( elem ).val() },
 *		set: function( elem, value ) { return $( elem ).val( value ) }
 *	});
 */
(function($) {
	$.hooksManager = function( hookCollection ) {
		this.hookCollection = hookCollection;
	}
	$.hooksManager.prototype = {
		router: function( elem, value, name ) {
			// Do reverse loop - if predicate ( function that returns true, or elem.is(...) ) -> use that hook & return.
			var type = name === undefined ? 'get' : 'set', i, hookSet, hook;
			for ( i = this.length - 1; i > -1; i-- ) {
				if ( (hook = (item = this[i])[type]) && ( $.isFunction( item.predicate ) ? item.predicate( elem ) : elem.is( item.predicate ) ) ) {
					return hook( elem, value, name );
				}
			}
		},
		register: function( type, predicate, handlers ) {

			// Quit if call was invalid.
			if ( !( type && $.type( predicate ) in { 'string': 1, 'function': 1 } && ('get' in handlers || 'set' in handlers) ) ) {
				return;
			}

			// If needed, init: hook-list & core-list.
			var hooks = this[type] || (this[type] = []),
				coreHook, coreHooks = this.hookCollection[type] || (this.hookCollection[type] = {}),
				oldHooks = {};

			// If router hasn't been set for get/set and it is required, do so.
			for ( type in { 'get': 1, 'set': 1 } ) {
				if ( (coreHook = coreHooks[type]) ? !coreHook.isRouter : type in handlers ) {
					// jQuery-core added a hook - keep it for later use.
					if ( coreHook ) {
						oldHooks[type] = coreHook;

						// Setter is always dealt with after getter, so we can add the hook to list.
						if ( type === 'set' ) {
							hooks.push( $.extend( oldHooks, { isCore: true, predicate: function() { return true; } } ) );
						}
					}

					// Set router for set/get.
					coreHooks[type] = $.proxy( this.router, hooks );
					coreHooks[type].isRouter = true;
				}
			}

			// Add handler to list.
			hooks.push( $.extend( { predicate: predicate }, handlers ) );
			return hooks.length - 1;
		},
		unregister: function( type, predicate ) {

			var hooks = this[type];

			if ( (hooks && hooks.length) ) {
				if ( $.type( predicate ) === 'number' && !hooks[predicate].isCore ) {
					// An index was supplied, remove that.
					hooks.splice( predicate, 1 );
				} else {
					// Filter out handlers by predicate match.
					hooks = $.grep( hooks, function( hook ) {
						return hook.isCore || item.predicate !== predicate;
					} );
				}

				// If the last hook-set was removed, remove list & restore "coreHooks".
				if ( !hooks.length ) {
					delete hooks[type], this.hookCollection[type];
				}
			}
		}
	};

	// Register for $( elem )["val" || "attr" || "prop" || css]( ... ).
	$.each({
			val: $.valHooks,
			attr: $.attrHooks,
			prop: $.propHooks,
			css: $.cssHooks
		},
		function( type, dataStore ) {
			$.hooksManager[type] = new $.hooksManager( dataStore );
		}
	);

})(jQuery);

/**
 * plasticInput is a jQuery plugin that attempts to normalize some of the most common HTML form inputs.
 * At the moment these are: text, password, textarea, radio, checkbox, file, select.
 * Currently multiselect is not supported, but may be in the near future.
 * Also, a possible port to jQuery.ui is also feasible.
 *
 * It requires jQuery 1.6+
 *
 * @version 0.1.1-alpha
 * @license GPL 3.0 http://www.gnu.org/licenses/gpl-3.0.html
 * @copyright Mazdak Farrokhzad <twingoow@gmail.com>
 */
(function($) {
/**
 * @todo Implement:
 *			1) Multi-select ?
 *			2) Button ?
 *			3) Port to jQuery.UI.Widget?
 *				http://www.erichynds.com/examples/jquery-ui-multiselect-widget/demos/
 *				http://www.erichynds.com/jquery/jquery-ui-multiselect-widget/
 */
	$.plasticInput = {
		settings: {
			useLabel: true,
			useOverlay: true,
			forwardEvents: true,
			file: {
				defaultText: 'Please select a file...',
				clearTitle: 'Clear!'
			},
			titleChangeTo: "text",	// false, "text", "title"
			optionTitleFromText: true
		},
		classes: {
			// Base & Type classes.
			base: 'plasticInput',
			text: 'plasticInput-text',
			password: 'plasticInput-password',
			textarea: 'plasticInput-textarea',
			select: 'plasticInput-select',
			file: 'plasticInput-file',
			radio: 'plasticInput-radio',
			checkbox: 'plasticInput-checkbox',
			bool: 'plasticInput-bool',

			// General classes.
			textWrapper: 'textwrapper',
			overlay: 'overlay',
			textBox: 'text',
			textData: 'text-data',
			focus: 'focus',
			hover: 'hover',

			// :radio & :checkbox.
			innerBorder: 'inner-border',
			fill: 'fill',
			checked: 'checked',

			// :file.
			clearFile: 'clear',
			hasFile: 'has-file',
			fileInput: 'file',
			fileIcon: 'icon',

			// <Select>.
			selectArrow: 'arrow',
			dropdown: 'dropdown',
			dropdownContent: 'dropdown-content',
			selectOption: 'option',
			selectOptionGroup: 'option-group',
			selectBottom: 'bottom',
			selectActive: 'active'
		},
		valHookAdd: true,
		valHookIndex: -1,
		currentSelectFocus: false,
		elements: []
	};

	// Can we use opacity on select?
	$.support.selectOpacity = !($.browser.msie && $.browser.version < 7);

	var classes = $.plasticInput.classes,
		// Adds overlay to {to} if allowed.
		addOverlay = function( settings, nodeName, to ) {
			settings.useOverlay && to.append( '<' + nodeName + ' class="' + classes.overlay + '"/>' );
			return to;
		},
		// "Toggle" class depending on event type.
		toggleState = function( check, e ) {
			$( this )[e.type === check[0] ? 'addClass' : 'removeClass']( classes[check[1] || check[0]] );
		},
		// Quicky for stopping propagation.
		stopPropagation = function( e ) {
			e.stopPropagation()
		},
		// noSelect v1.0 Provided by Mathias Bynens <http://mathiasbynens.be/> and his noSelect plugin.
		// https://github.com/mathiasbynens/jquery-noselect
		noSelect = function( elem ) {
			function f() { return false; };

			$( elem ).each(function() {
				this.onselectstart = this.ondragstart = f; // Webkit & IE
				$( this )
					.mousedown(f) // Webkit & Opera
					.css({ MozUserSelect: 'none' }); // Firefox
			});
		},
		// Forward an event to e.data.target, avoid recursion.
		forwardEvent = function( e ) {
			if ( !e.isPIForward ) {
				e.isPIForward = true;
				e.data.target.trigger( e );
			}

			stopPropagation( e );
		},
		// List of transformers.
		transformers = {
			// Text/Password/Textarea.
			"text password textarea|textarea": function( old, obj, settings ) {
				obj.input = $( '<' + (obj.type === 'textarea' ? obj.type : 'input type="' + obj.type + '"') + ' class="' + classes.textBox + '"/>' )
					.appendTo( obj.textWrapper )
					.attrsFrom( old, 'value' + (obj.type === 'textarea' ? '' : ' maxlength readonly') );

				// Set title if allowed (this option only has relevance with "text" as value).
				obj.type === 'text' && settings.titleChangeTo === 'text' && obj.input.bind( 'change.plasticInput', function() {
					obj.textWrapper.attr( 'title', $.trim( obj.input.val() ) );
				});
			},
			// Boolean (Radio/Checkbox).
			"checkbox radio": function( old, obj, settings ) {
				var name,
					setVal = function( elems, check ) {
						return $.each( elems, function() {
							var $t = $( this );
							$t.add( $t.closest( '.' + classes.base ) ).prop( 'checked', check )
								.closest( '.' + classes.textWrapper )[check ? 'addClass' : 'removeClass']( classes.checked );
						});
					};

				$.extend( obj, {
					// Make input.
					input: $( '<input class="' + classes.textBox + '" type="' + obj.type + '" tabindex="-1" />' ).appendTo( obj.textWrapper )
								.after( '<div class="' + classes.innerBorder + '"><div class="' + classes.fill + '"></div></div>' ),
					// Provides method: Is input checked?
					isChecked: function() {
						return obj.input.prop( 'checked' );
					},
					// Provide method for toggling on/off.
					set: function( val ) {
						val = $.type( val ) === 'boolean' ? val : !obj.isChecked();
						if ( obj.type !== 'radio' || obj.type === 'radio' && val ) {
							setVal( obj.input, obj.type === 'radio' ? true : val ).trigger( 'change' );
						}
					}
				});

				// When space is pressed, emulate a click.
				obj.receiver = obj.textWrapper.bind( 'keydown.plasticInput', function( e ) {
					e.which === 32 && $( this ).trigger( 'click' );
				});

				// If a radio-button in group is clicked, uncheck the other buttons in the group.
				obj.type === 'radio' && (name = old.attr( 'name' )).length && $( 'input:radio[name="' + name + '"]' ).add( obj.input )
					.unbind( 'change.plasticInput-internal' )
					.bind( 'change.plasticInput-internal', function() {
						setVal( $( 'input:radio[name="' + name + '"]' ).not( this ), false );
					} );

				// Setup value.
				old.addClass( classes['bool'] ).prop( 'checked' ) && obj.set( true );

				return {
					onStateChange: function( obj, state ) {
						return {
							'click': state ? 1 : $.proxy( obj.set, obj )
						};
					}
				}
			},
			// File.
			"file": function( old, obj, settings ) {
				// Replaces file input with new one so that it is cleared.
				obj.clear = function( e ) {
					e instanceof $.Event && stopPropagation( e );
					change( 'removeClass', settings.file.defaultText );
					obj.input.replaceWith( makeFile( obj.input ) );
				}

				var textData = $( '<div class="' + classes.textData + '">' + settings.file.defaultText + '</div>' ),
					change = function( method, text ) {
						obj.textWrapper[method]( classes.hasFile );
						textData.text( text );
					},
					// Returns an <input:file/> element.
					makeFile = function( oldInput ) {
						return obj.input = $( '<input class="' + classes.fileInput + '" type="file" />' )
							.attrsFrom( oldInput, 'title accept name tabindex accesskey' )
							.bind({
								'focus.plasticInput blur.plasticInput': $.proxy( toggleState, obj.textWrapper, ['focus'] ),
								'click.plasticInput': stopPropagation,
								'change.plasticInput': function() {
									change( 'addClass', $( this ).val() );
								}
							})
					};

				// Do the DOM work!
				$( '<span class="' + classes.clearFile + '" title="' + settings.file.clearTitle + '">' )
					.appendTo( obj.textWrapper.before( makeFile( old ) ) )
					.before( '<span class="' + classes.fileIcon + '"></span>' )
					.after( $( '<div class="' + classes.textBox + '">' ).append( textData ) )
					.bind( 'click.plasticInput', obj.clear );
			},
			// Select.
			"select|select": function( old, obj, settings ) {

				// Add dropdown.
				var dropdown = $('<div class="' + classes.dropdown + '" tabindex="-1"></div>').insertAfter( obj.textWrapper )
						.bind( 'click.plasticInput', stopPropagation ),
					dropdownContent = addOverlay( settings, 'li', $( '<ul class="' + classes.dropdownContent + '"></ul>' ) ).appendTo( dropdown );

				$.extend( obj, {
					current: false,
					hovered: false,
					hoveredIndex: NaN,
					currentIndex: NaN,
					input: $( '<input type="hidden" value="0"/>' ).insertBefore( obj.textWrapper ),
					// Shows or hides the dropdown.
					toggle: function( e, doTrigger ) {

						var action, what;

						if ( !( action = !(e instanceof $.Event) ? e :
								e.type === 'focusin' && e.focusFrom === $.focusFrom.mouse ? false :
								(e.type === 'click' ? dropdown.is( ':visible' ) ? [doTrigger ^= 0, 'blur'] : [0, 'focusin'] : [stopPropagation( e ), e.type]).pop() ) ) {
							return;
						}

						if ( action === 'focusin' ) {
							if ( dropdown.is( ':visible' ) ) {
								// Don't reshow if already visible.
								return;
							} else if ( $.plasticInput.currentSelectFocus ) {
								// Hide the one that has focus.
								$.plasticInput.currentSelectFocus.data( 'plasticInput.select' ).toggle( 'blur' );
							}

							// Set this one as current.
							$.plasticInput.currentSelectFocus = this.wrapper;

							// Hide this when any place outside of this <select> is clicked.
							$( document ).unbind( '.plasticInput-select-bind' ).bind( 'click.plasticInput-select-bind focusin.plasticInput-select-bind', function( e ) {
								if ( !(
									e.target === document ||
									$( e.target ).parents( '.' + classes.select ).length && $( e.target ).parents( '.' + classes.select ).get( 0 ) == obj.wrapper.get( 0 ))
								) {
									obj.toggle( 'blur' );
									$( document ).unbind( '.plasticInput-select-bind' );
								} else {
									obj.textWrapper.trigger( 'focus' );
								}
							});

							// Show dropdown! If the dropdown ends outside of viewport - then "dropup" instead.
							dropdown.slideDown( 1, function() {
								if ( window.innerHeight + $( window ).scrollTop() < dropdown.offset().top + dropdown.height() ) {
									dropdown.addClass( classes.selectBottom );
								}
							});

							// Scroll to selected option.
							this.current && this.scroll( this.current );
						} else {
							// Hide dropdown.
							dropdown.slideUp( 1, function() {
								dropdown.removeClass( classes.selectBottom )
							});

							$.plasticInput.currentSelectFocus = false;
							$( document ).unbind( '.plasticInput-select-bind' );

							// "de-hover" the current if any element that has hover.
							this.hoveredIndex = NaN;
							this.hovered && this.hovered.removeClass( classes.hover );
						}

						toggleState.call( this.textWrapper, ['focus'], { type: (what = action === 'focusin' ? 'focus' : 'blur') } );

						if ( action === 'focusin' ? doTrigger : this.textWrapper.is( ':focus' ) ) {
							this.textWrapper.trigger( what );
						}
					},
					// Takes a HTML <option> and appends it.
					append: function( index, elem, to ) {

						to = to || dropdownContent;
						elem = $( elem || index );

						var opt, label;

						if ( elem.is( 'optgroup ' ) ) {
							// Make the group.
							opt = $( '<li class="' + classes.selectOptionGroup + '">' +
										((label = elem.attr( 'label' )) && label.length ? '<h3>' + label + '</h3>' : '') +
										'<ul></ul>' +
									 '</li>' ).appendTo( to );

							// Append all options to it (nested optgroups are not allowed in (x)HTML even in v5).
							to = opt.children( 'ul' );
							elem.children( 'option' ).each( function( index, child ) {
								obj.append( index, child, to );
							} );
						} else {
							// Make the option.
							opt = $( '<li class="' + classes.selectOption + '">' + (label = elem.text()) + '</li>' ).appendTo( to )
								.attrsFrom( elem, 'title', { title: function( key, val ) {
									return $.trim( settings.optionTitleFromText ? label : val );
								}})
								.data( 'plasticInput:value', elem.prop( 'value' ) )
								.bind({
									'click.plasticInput': $.proxy( this.select, this ),
									'mousemove.plasticInput': $.proxy( this.navigate, this )
								});

							// Select if selected.
							elem.attr( 'selected' ) && this.set( opt );
						}

						// Disable if disabled.
						elem.prop( 'disabled' ) && opt.addClass( 'disabled' ).prop( 'disabled', true );
					},
					// Get all enabled options.
					getEnabledOptions: function() {
						return dropdownContent.find( '.' + classes.selectOption ).not( this.isOptionDisabled );
					},
					// Tests if an option is disabled (or is part of a disabled option-group).
					isOptionDisabled: function( key, elem ) {
						return $( elem || key ).closest( '.disabled', dropdownContent ).length;
					},
					// Navigate to an option.
					navigate: function( e ) {

						var newIndex,
							options = this.getEnabledOptions();

						// Select the new one!
						if ( e.type === 'mousemove' ) {
							newIndex = options.index( e.currentTarget );
						} else if ( e.type === 'keydown' ) {

							if ( e.which < 33 || e.which > 41 ) {
								// Only respond to navigation keys - forward <Enter> to select().
								return e.which === 13 ? this.select( e ) : null;
							}

							// Don't allow page scrolling.
							e.preventDefault();

							// L [Last-index].
							var last = options.length - 1;

							// Make sure we have a previous hovered element (use this.current or 0 as backup).
							newIndex = isNaN( this.hoveredIndex ) ? (isNaN( this.currentIndex ) ? 0 : this.currentIndex) : this.hoveredIndex;

							// Depending on keystroke - pick a new hovered elem.
							if ( e.which === 36 || (e.which === 34 ? (newIndex += Math.round( last / 5) ) : (e.which in {40:1, 39:1} ? ++newIndex : false)) > last ) {
								// If [ Home ] || [ [ newIndex += 1 || [ PageUp: L / 5 ] ] > L ]. 
								newIndex = 0;
							} else if ( e.which === 35 || (e.which === 33 ? (newIndex -= Math.round( last / 5 )) : (e.which in {38:1, 37:1} ? --newIndex : false)) < 0 ) {
								// If [ End ] || [ [ newIndex -= 1 || [ PageDown: L / 5 ] ] < 0 ].
								newIndex = last;
							}
						} else if ( e.type === 'keypress' && e.which > 32 && !(e.altKey ^ e.ctrlKey) ) {

							// Search for 0-index character.
							var text, code = String.fromCharCode( e.which ).toLowerCase(),
								length = options.length, elem,
								start = isNaN( this.hoveredIndex ) ? (isNaN( this.currentIndex ) ? 0 : this.currentIndex + 1) : this.hoveredIndex + 1,
								curr = start;

							do {
								if ( (text = options.eq( curr ).text()).length && text[0].toLowerCase() === code ) {
									// Match! Set this one and be pleased.
									newIndex = curr;
									break;
								} else if ( curr > length - 2 && start !== 0 ) {
									// We've reached End and still no match - redo loop from curr to length.
									curr = 0;
									length = start;
								}
								curr++;
							} while ( curr < length );
						}

						// None found or same as before? - Quit!
						if ( newIndex === undefined || this.hoveredIndex === newIndex ) {
							return;
						}

						// Remove hover from old.
						this.hovered && this.hovered.removeClass( classes.hover );

						// Set new as current.
						this.hoveredIndex = newIndex;
						this.hovered = options.eq( this.hoveredIndex ).addClass( classes.hover );

						// Scroll to new element if keydown.
						if ( e.type !== 'mousemove' ) {
							this.scroll( this.hovered );
						}
					},
					// Changes the currently selected option.
					set: function( to ) {

						var text, options = this.getEnabledOptions();

						// Set currentIndex.
						if ( $.type( to ) === 'number' ) {
							if ( !(options = options.eq( to )).length ) {
								return;
							}
							this.currentIndex = to;
							to = options;
						} else {
							this.currentIndex = options.index( to );
						}

						// Remove active class on prev-current & Set new as current.
						this.current && this.current.removeClass( classes.selectActive );
						this.current = to;

						// Set value.
						this.input.val( to.data( 'plasticInput:value' ) ).trigger( 'change' );

						// Set text and add active class.
						this.wrapper.find( '.' + classes.textData ).html( text = $.trim( to.addClass( classes.selectActive ).text() ) );

						// Set title if allowed.
						if ( settings.titleChangeTo !== false) {
							this.textWrapper.attr( 'title', settings.titleChangeTo === 'text' ? text : $.trim( to.attr( 'title' ) ) );
						}
					},
					// Select an option.
					select: function( e ) {

						// Get the element that was clicked or got hit by <Enter>.
						var elem = e.type === 'keydown' ? this.hovered : $( e.currentTarget );

						if ( !this.isOptionDisabled( elem ) ) {
							this.toggle( 'blur', e.type === 'keydown' );

							// If nothing was hovered, or if elem is the same as the current one - don't select it.
							elem.length && !(elem.length && this.currentIndex === this.hoveredIndex ) && this.set( elem );
						}
					},
					// Scroll to an element.
					scroll: function( to ) {
						dropdown
							.scrollTo( to )
							.scrollTo( this.getEnabledOptions().get( -1 ) === to.get( 0 ) ? 'max' : '-=' + parseInt( to.css( 'margin-top' ) ) * 2 + 'px' );
					}
				});

				obj.receiver = obj.textWrapper
					.bind( 'keydown.plasticInput keypress.plasticInput', $.proxy( obj.navigate, obj ) )
					.append(
						'<div class="'  + classes.selectArrow + '"></div>' +
						'<div class="' + classes.textBox + '"><div class="' + classes.textData + '"></div></div>'
					);

				noSelect( obj.textWrapper.find( '.' + classes.textData ) );

				// Transfer options from the <select> to our wrapper.
				old.children( 'option, optgroup' ).each( $.proxy( obj.append, obj ) );

				return {
					onStateChange: function( obj, state ) {
						return {
							'iFocusin click': state ? obj.toggle( 'blur' ) : $.proxy( obj.toggle, obj )
						};
					}
				};
			}
		},
		defaultTransformer = ['text', transformers['text password textarea|textarea']],
		// Disables or Enables.
		setState = function( obj, state, instructions, init ) {
			if ( obj.isDisabled !== state || init ) {
				obj.isDisabled = state;

				obj.textWrapper[state ? 'addClass' : 'removeClass']( 'disabled' )
					.add( obj.wrapper ).add( obj.input )
						.attr( 'disabled', state );

				obj.receiver
					.blur()
					[state ? 'bind' : 'unbind']( 'focus.plasticInput-internal', state ? function( e ) { obj.receiver.blur(); } : undefined );

				if ( instructions && instructions.onStateChange ) {
					var key, events = instructions.onStateChange( obj, state );
					for ( key in events ) {
						obj.receiver[state ? 'unbind' : 'bind']( key + '.plasticInput', $.isFunction( events[key] ) ? events[key] : undefined );
					}
				}
			}
		};

	var PlasticInput = function( elem, settings ) {

		// If first time, init hooks for elem.val().
		// Relays any calls to val() on wrapper to :input - for setting it calls "this.set()" instead if defined.
		if ( $.plasticInput.valHookAdd && $.plasticInput.valHookIndex === -1 ) {
			$.plasticInput.valHookIndex = $.hooksManager.val.register( 'div', function( elem ) { return !!$( elem ).data( 'plasticInput' ) }, {
				get: function( elem ) {
					return $( elem ).find( ':input' ).val();
				},
				set: function( elem, value ) {
					var instance = $( elem ).data( 'plasticInput' );
					return instance.set ? instance.set( value ) : $( elem ).find( ':input' ).val( value );
				}
			} );
		}

		var $this = this, old = $( elem ), label,
			instructions, test, predicates, predicate, i;

		// Make wrapper and remove old from DOM.
		this.wrapper = $( '<div>' ).data( 'plasticInput', this );
		$.plasticInput.elements.push( this.wrapper[0] );
		old.after( this.wrapper ).remove();

		// Set title.
		this.textWrapper = addOverlay( settings, 'div', $( '<div class="' + classes.textWrapper + '">' ).appendTo( this.wrapper ) );

		// Find correct type and use it's transformer.
		for ( test in transformers ) {
			for ( i = 0; i < (predicates = test.split( ' ' )).length; i++ ) {
				// Check if it's of this type.
				if ( old.is( ((predicate = predicates[i].split( '|' ))[1] || 'input:' + predicate[0]) + ',.' + classes[predicate[0]] ) ) {
					this.type = predicate[0];
					instructions = transformers[test]( old, this, settings );
					break;
				}
			}
		}

		if ( !this.type ) {
			// Fallback to default.
			this.type = defaultTransformer[0];
			instructions = defaultTransformer[1]( old, this, settings );
		}

		// Copy name to input.
		this.input.attrsFrom( old, 'name' );

		// Copy tabindex & accesskey to textWrapper or :input.
		(this.receiver || (this.receiver = this.input)).attrsFrom( old, 'tabindex accesskey' );

		// On focus/blur, add/remove focus-class ( <Select> implements this differently ).
		this.type !== 'select' && this.receiver.bind( 'focus.plasticInput blur.plasticInput', $.proxy( toggleState, this.textWrapper, ['focus'] ) );

		// Copy title to textWrapper ( :file applies this copy to :input ).
		this.type !== 'file' && this.textWrapper.attrsFrom( old, 'title' );

		// Add .class(es), Set #id.
		this.wrapper.attrsFrom( old, 'id class', {
			'class': function( val ) {
				val = val ? val.replace( new RegExp( '(^|\\s)' + classes.base + '($|\\s)', 'ig' ), '' ) : '';
				return $.trim( [val, classes.base, classes[$this.type]].join( ' ' ) );
			}
		});

		// Fix label if exists (click).
		settings.useLabel && (label = $( 'label[for="' + this.wrapper.attr( 'id' ) + '"]' )).length && label.bind({
			'click.plasticInput': function( e ) {
				stopPropagation( e );
				$this.receiver.trigger( $this.receiver.is( ':input' ) ? 'focus' : 'click', true );
			},
			'mouseenter.plasticInput mouseleave.plasticInput': $.proxy( toggleState, this.textWrapper, ['mouseenter', 'hover'] )
		});

		// Normalize events throughout DOM. Events sent to input/textWrapper are forwarded to wrapper, and wrapper forwards to the former.
		if ( settings.forwardEvents ) {
			this.input.bind( 'change', { target: this.wrapper }, forwardEvent );
			this.receiver.bind( 'focus.plasticInput blur.plasticInput click.plasticInput', { target: this.wrapper }, forwardEvent );
			this.wrapper.bind( 'change.plasticInput', { target: this.input }, forwardEvent )
						.bind( 'focus.plasticInput blur.plasticInput click.plasticInput', { target: this.receiver }, forwardEvent );
		}

		// Set state (disable/enable).
		setState( this, !!old.attr( 'disabled' ), instructions, true );
		this.disable = function() { setState( this, true, instructions ) };
		this.enable = function() { setState( this, false, instructions ) };

		this.restore = function() {

			if ( this.type === 'select' ) {
				// <Select> needs special attention, so make a new <select> before wrapper.
				this.input = this.wrapper.before( $( '<select>' ).attrsFrom( input, 'name value' ) ).prev();

				// Copy all options over, and select 'em if they were selected.
				this.wrapper.find( '.' + classes.selectOption ).each( function() {
					var $t = $( this ),
						opt = $( '<option>' ).appendTo( input )
							.text( $t.text() )
							.attrsFrom( $t, 'value title' )
							.attr( 'selected', $t.is( '.' + classes.selectActive ) ? 'selected' : undefined );
				});
			} else {
				this.input.siblings().remove().end().unwrap();
				this.type !== 'file' && this.input.unwrap() && this.type in { radio: 1, checkbox: 1 } && this.wrapper.removeClass( classes.bool );
			}

			// Remove the type class.
			this.wrapper.removeClass( classes[this.type] );

			this.input
				.attrsFrom( this.wrapper, 'id class' )
				// If [<Select> || :radio || :checkbox] -> Move tabindex & accesskey from {textWrapper} to :input.
				.attrsFrom( this.textWrapper, 'title' + (this.type in { 'select': 1, 'radio': 1, 'checkbox': 1 } ? ' tabindex accesskey' : '') )
				// Unbind any plasticInput events on :input & <label> (if <label> is present) events.
				.add( 'label[for="' + this.wrapper.attr( 'id' ) + '"]' ).unbind( '.plasticInput .plasticInput-internal' );

			// Finally, remove wrapper - hopefully destroying this.
			$.plasticInput.elements.splice( $.inArray( this.wrapper[0], $.plasticInput.elements ), 1 );
			this.wrapper.remove();

			// If all have been restored, remove our hook from $.valHooks.
			if ( $.plasticInput.valHookAdd && $.plasticInput.elements.length < 1 ) {
				$.hooksManager.val.unregister( 'div', $.plasticInput.valHookIndex );
				$.plasticInput.valHookIndex = -1;
			}
		};

		return this;
	};

	// Public Interface.
	$.fn.plasticInput = function( settings ) {

		if ( !$.support.selectOpacity ) {
			return this;
		}

		var args = arguments,
			settingsComputed = false,
			command = $.type( settings ) === 'string' ? settings : false;

		return this.each(function() {

			var instance = $( this ).data( 'plasticInput' );

			// First time? Init instance.
			if ( !instance ) {
				if ( settings === 'restore' ) {
					// No use in transforming it to then restore it immediately after.
					return;
				} else if ( !settingsComputed ) {
					settingsComputed = true;
					settings = $.extend( true, {}, $.plasticInput.settings, command ? {} : settings );
				}

				instance = new PlasticInput( this, settings );
			}

			if ( command ) {
				instance[command].apply( instance, args );
			}
		});
	};
})(jQuery);