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

  GroupedCollection.GroupModel = Backbone.Model;
  GroupedCollection.GroupCollection = Backbone.Collection.extend({
    closeWith: function (eventEmitter) {
      eventEmitter.on('close', this.stopListening);
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
    var Constructor = options.GroupCollection || GroupedCollection.GroupCollection;

    needs(options, 'collection', 'The base collection to group');
    needs(options, 'groupBy', 'The function that returns a model\'s group id');

    options.groupCollection = new Constructor(null, {
      comparator: options.comparator
    });

    GroupedCollection._onReset(options);
    options.groupCollection.listenTo(options.collection, 'add', _.partial(GroupedCollection._onAdd, options));
    options.groupCollection.listenTo(options.collection, 'change', _.partial(GroupedCollection._onAdd, options));
    options.groupCollection.listenTo(options.collection, 'remove', _.partial(GroupedCollection._onRemove, options));
    options.groupCollection.listenTo(options.collection, 'reset', _.partial(GroupedCollection._onReset, options));


    if (!options.close_with) {
      console.warn('You should provide an event emitter via `close_with`,' +
        ' or else the listeners will never be unbound!');
    } else {
      options.groupCollection.listenToOnce(options.close_with,
          'close', options.groupCollection.stopListening);
      options.groupCollection.listenToOnce(options.close_with,
          'destroy', options.groupCollection.stopListening);
    }

    return options.groupCollection;
  };

  /**
   * Creates a Group model for a given id.
   *
   * @param {Object} options
   * @param {String} groupId
   * @return {Group}
   */
  GroupedCollection._createGroup = function (options, groupId) {
    var Constructor = options.GroupModel || GroupedCollection.GroupModel,
        vc, group, vcOptions;

    vcOptions = _.extend(options.vc_options || {}, {
      filter: function (model) {
        return options.groupBy(model) === groupId;
      },
      close_with: options.close_with
    });

    vc = new Backbone.VirtualCollection(options.collection, vcOptions);
    group = new Constructor({id: groupId, vc: vc});
    group.vc = vc;
    vc.listenTo(vc, 'remove', _.partial(GroupedCollection._onVcRemove, options.groupCollection, group));

    return group;
  };

  /**
   * Handles the add event on the base collection
   *
   * @param {Object} options
   * @param {Model} model
   */
  GroupedCollection._onAdd = function (options, model) {
    var id = options.groupBy(model);

    if (!options.groupCollection.get(id)) {
      options.groupCollection.add(GroupedCollection._createGroup(options, id));
    }
  };

  /**
   * Handles the remove event on the base collection
   *
   * @param {Object} options
   * @param  {Model} model
   */
  GroupedCollection._onRemove = function (options, model) {
    var id = options.groupBy(model),
        group = options.groupCollection.get(id);

    if (group && !group.vc.length) {
      options.groupCollection.remove(group);
    }
  };

  /**
   * Handles the reset event on the base collection
   *
   * @param {Object} options
   */
  GroupedCollection._onReset = function (options) {
    var groupIds = _.uniq(options.collection.map(options.groupBy));
    options.groupCollection.reset(_.map(groupIds, _.partial(GroupedCollection._createGroup, options)));
  };

  /**
   * Handles vc removal
   *
   * @param {VirtualCollection} groupCollection
   * @param {?} group
   */
  GroupedCollection._onVcRemove = function (groupCollection, group) {
    if (!group.vc.length) {
      groupCollection.remove(group);
    }
  };

  Backbone.buildGroupedCollection = GroupedCollection.buildGroupedCollection;

  return GroupedCollection;

}));
