/* global define */
/* eslint strict: [2, "function"] wrap-iife: 0 */
(function (global, factory) {
  'use strict';
  // Set up Backbone appropriately for the environment. Start with AMD.
  if (typeof define === 'function' && define.amd) {   //eslint-disable-line underscore/prefer-underscore-typecheck
    define(['underscore', 'backbone'], factory);

  // Next for Node.js or CommonJS.
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('underscore'), require('backbone'));

  // Finally, use browser globals.
  } else {
    factory(global._, global.Backbone);
  }

}(this, function (_, Backbone) {
  'use strict';
  var GroupedCollection = Backbone.GroupedCollection = {};
  /**
   * Checks a parameter from the obj
   *
   * @param {Object} obj         parameters
   * @param {String} name        of the parameter
   * @param {String} explanation used when throwing an error
   */
  function needs(obj, name, explanation) {
    if (!obj[name]) {
      throw new Error('Missing parameter ' + name + '. ' + explanation);
    }
  }

  var GroupModel = GroupedCollection.GroupModel = Backbone.Model;
  var GroupCollection = GroupedCollection.GroupCollection = Backbone.Collection.extend({
    initialize: function(models, opts) {
      if(opts.parentInitialize) {
        opts.parentInitialize.apply(this, arguments);
      }
      this.collection = opts.collection;
      if(opts.GroupModel) {
        this.model = opts.GroupModel;
      }
      this.opts = opts;

      this._onReset(opts);
      
      this.listenTo(this.collection, 'add', this._onAdd);
      this.listenTo(this.collection, 'change', this._onAdd);
      this.listenTo(this.collection, 'remove', this._onRemove);
      this.listenTo(this.collection, 'reset', this._onReset);

      if (!opts.close_with) {
        console.warn('You should provide an event emitter via `close_with`,' +
          ' or else the listeners will never be unbound!');
      } else {
        this.listenToOnce(opts.close_with,
            'close', this.stopListening, this);
        this.listenToOnce(opts.close_with,
            'destroy', this.stopListening, this);
      }
    },
    model: GroupModel,

    /**
     * Creates a Group model for a given id.
     *
     * @param {String} groupId
     * @return {Group}
     */
    _createGroup: function (groupId) {
      var Model = this.model,
        groupBy = this.opts.groupBy,
          vc, group, vcOptions;

      vcOptions = _.extend(this.vc_options || {}, {
        filter: function (model) {
          return groupBy(model) === groupId;
        },
        close_with: this.opts.close_with
      });

      vc = new Backbone.VirtualCollection(this.collection, vcOptions);
      group = new Model({id: groupId, vc: vc});
      group.vc = vc;
      this.listenToOnce(vc, 'remove', _.partial(this._onVcRemove, group));
      this.trigger('created:group', group);

      return group;
    },

    /**
     * Handles the add event on the base collection
     *
     * @param {Model} model
     */
    _onAdd: function (model) {
      var id = this.opts.groupBy(model);

      if (!this.get(id)) {
        this.add(this._createGroup(id));
      }
    },

    /**
     * Handles the remove event on the base collection
     *
     * @param  {Model} model
     */
    _onRemove: function (model) {
      var id = this.opts.groupBy(model),
          group = this.get(id);

      if (group && !group.vc.length) {
        this.remove(group);
      }
    },

    /**
     * Handles the reset event on the base collection
     */
    _onReset: function () {
      var groupBy = this.opts.groupBy,
        groupIds = _.uniq(this.collection.map(groupBy));
      this.reset(_.map(groupIds, this._createGroup, this));
    },

    /**
     * Handles vc removal
     *
     * @param {?} group
     */
    _onVcRemove: function (group) {
      if (!group.vc.length) {
        this.remove(group);
      }
    }
  });

  /**
   * Function that returns a collection of sorting groups
   *
   * @param {Object} options
   *  - {Collection} collection (base collection)
   *  - {Function} groupby (function that returns a model's group id)
   *
   *  - {[Function]} comparator
   *  - {[Function]} GroupModel the group model
   *  - {[Function]} GroupCollection the groups collection
   *
   * @return {Collection}
   */
  GroupedCollection.buildGroupedCollection = function (options) {
    var Constructor = options.GroupCollection || GroupCollection;
    if(!(Constructor.prototype instanceof GroupCollection || Constructor.prototype === GroupCollection.prototype)) {
      options.parentInitialize = Constructor.prototype.initialize;
      Constructor = Constructor.extend(GroupCollection.prototype);
    }

    needs(options, 'collection', 'The base collection to group');
    needs(options, 'groupBy', 'The function that returns a model\'s group id');

    return new Constructor(null, options);
  };

  Backbone.buildGroupedCollection = GroupedCollection.buildGroupedCollection;

  return GroupedCollection;

}));
