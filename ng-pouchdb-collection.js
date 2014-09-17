angular.module('pouchdb')

  .factory('pouchCollection', ['$timeout', 'PouchDB', function($timeout, PouchDB) {

    /**
     * @class item in the collection
     * @param item
     * @param {int} index             position of the item in the collection
     *
     * @property {String} _id         unique identifier for this item within the collection
     * @property {int} $index         position of the item in the collection
     */
    function PouchDbItem(item, index) {
      this.$index = index;
      angular.extend(this, item);
    }

    /**
     * create a pouchCollection
     * @param  {String} collectionUrl The pouchdb url where the collection lives
     * @return {Array}                An array that will hold the items in the collection
     */
    return function(collectionUrl) {
      var collection = [];
      var indexes = {};
      var db = new PouchDB(collectionUrl);

      function getIndex(prevId) {
        return prevId ? indexes[prevId] + 1 : 0;
      }

      function addChild(index, item) {
        indexes[item._id] = index;
        collection.splice(index,0,item);
        console.log('added: ', index, item);
      }

      function removeChild(id) {
        var index = indexes[id];

        // Remove the item from the collection
        collection.splice(index, 1);
        indexes[id] = undefined;

        console.log('removed: ', id);
      }

      function updateChild (index, item) {
        collection[index] = item;
        console.log('changed: ', index, item);
      }

      function updateIndexes(from, to) {
        var length = collection.length;
        to = to || length;
        if ( to > length ) { to = length; }
        for(index = from; index < to; index++) {
          var item = collection[index];
          item.$index = indexes[item._id] = index;
        }
      }

      db.changes({live: true, onChange: function(change) {
        if (!change.deleted) {
          db.get(change.id).then(function (data){
            if (!indexes[change.id]) { // CREATE / READ
              addChild(0, new PouchDbItem(data, 0)); // Forced index to 0
              updateIndexes(0);
            } else { // UPDATE
              var index = indexes[change.id];
              var item = new PouchDbItem(data, index);
              updateChild(index, item);
            }
          });
        } else { //DELETE
          removeChild(change.id);
          updateIndexes(indexes[change.id]);
        }
      }});

      collection.$add = function(item) {
        db.post(angular.copy(item)).then(
          function(res) {
            item._rev = res.rev;
            item._id = res.id;
          }
        );
      };
      collection.$remove = function(itemOrId) {
        var item = angular.isString(itemOrId) ? collection[itemOrId] : itemOrId;
        db.remove(item)
      };

      collection.$update = function(itemOrId) {
        var item = angular.isString(itemOrId) ? collection[itemOrId] : itemOrId;
        var copy = {};
        angular.forEach(item, function(value, key) {
          if (key.indexOf('$') !== 0) {
            copy[key] = value;
          }
        });
        db.get(item._id).then(
          function (res) {
            db.put(copy, res._rev);
          }
        );
      };

      return collection;
    };
  }]);