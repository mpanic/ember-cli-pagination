import Ember from 'ember';
import Util from 'ember-cli-pagination/util';
import LockToRange from 'ember-cli-pagination/watch/lock-to-range';
import { QueryParamsForBackend, ChangeMeta } from './mapping';
import PageMixin from '../page-mixin';
import PromiseProxyMixin from '@ember/object/promise-proxy-mixin';
import RSVP from 'rsvp';

var ArrayProxyPromiseMixin = Ember.Mixin.create(PromiseProxyMixin, {
  then: function(success,failure) {
    debugger;
    var promise = this.get('promise');
    var me = this;

    return promise.then(function() {
      debugger;
      return success(me);
    }, failure);
  }
});
var ArrayProxyPromiseMixin2 = Ember.Mixin.create(PromiseProxyMixin, {
  // then: function(success,failure) {
  //   debugger;
  //   var promise = this.get('promise');
  //   var me = this;

  //   // return promise.then(function() {
  //   //   debugger;
  //   //   return success(me);
  //   // }, failure);
  //   return promise;
  // }
  then: function(success,failure) {
    debugger;
    var promise = this.get('promise');
    var me = this;

    return promise.then(function() {
      debugger;
      return success(me);
    }, failure);
  }
});

// export default Ember.ArrayProxy.extend(PageMixin, Ember.Evented, ArrayProxyPromiseMixin, {
// export default Ember.ArrayProxy.extend(PageMixin, Ember.Evented, {
export default Ember.ArrayProxy.extend(PageMixin, Ember.Evented, ArrayProxyPromiseMixin2, {
  page: 1,
  paramMapping: Ember.computed(() => {
    return {};
  }),
  contentUpdated: 0,

  async init() {
    debugger;
    this._super(...arguments);

    var initCallback = this.get('initCallback');
    if (initCallback) {
      initCallback(this);
    }

    this.addArrayObserver({
      arrayWillChange(me) {
        me.trigger('contentWillChange');
      },
      arrayDidChange(me) {
        me.incrementProperty('contentUpdated');
        me.trigger('contentUpdated');
      },
    });

    try {
      this.get('promise');
    }
    catch (e) {
      console.log('PagedRemoteArray promise exception', e.message);
      this.set('promise', await this.fetchContent());
    }
  },

  addParamMapping: function(key,mappedKey,mappingFunc) {
    var paramMapping = this.get('paramMapping') || {};
    if (mappingFunc) {
      paramMapping[key] = [mappedKey,mappingFunc];
    }
    else {
      paramMapping[key] = mappedKey;
    }
    this.set('paramMapping',paramMapping);
    this.incrementProperty('paramsForBackendCounter');
    //this.pageChanged();
  },

  addQueryParamMapping: function(key,mappedKey,mappingFunc) {
    return this.addParamMapping(key,mappedKey,mappingFunc);
  },

  addMetaResponseMapping: function(key,mappedKey,mappingFunc) {
    return this.addParamMapping(key,mappedKey,mappingFunc);
  },

  paramsForBackend: Ember.computed('page','perPage','paramMapping','paramsForBackendCounter','zeroBasedIndex', function() {
    var page = this.getPage();
    if (this.get('zeroBasedIndex')) {
      page--;
    }

    var paramsObj = QueryParamsForBackend.create({page: page,
                                                  perPage: this.getPerPage(),
                                                  paramMapping: this.get('paramMapping')});
    var ops = paramsObj.make();

    // take the otherParams hash and add the values at the same level as page/perPage
    ops = Util.mergeHashes(ops,this.get('otherParams')||{});

    return ops;
  }),

  OLD_rawFindFromStore: function() {
    debugger;
    var store = this.get('store');
    var modelName = this.get('modelName');

    var ops = this.get('paramsForBackend');
    var res = store.query(modelName, Object.assign({},ops)); // always create a shallow copy of `ops` in case adapter would mutate the original object

    return res;
  },

  async rawFindFromStore() {
    debugger;
    var store = this.get('store');
    var modelName = this.get('modelName');

    var ops = this.get('paramsForBackend');
    let rez = await store.query(modelName, Object.assign({}, ops)); // always create a shallow copy of `ops` in case adapter would mutate the original object
    debugger;
    return rez;
  },

  async fetchContent() {
    return new Promise(function(resolve, reject) {
      this.set("loading", true);
      var rows;
      try {
        rows = await this.rawFindFromStore();
        this.incrementProperty("numRemoteCalls");
        var me = this;
      
        var metaObj = ChangeMeta.create({paramMapping: me.get('paramMapping'),
                                         meta: rows.meta,
                                         page: me.getPage(),
                                         perPage: me.getPerPage()});

        me.set("loading",false);
        me.set("meta", metaObj.make());
        resolve(rows);
      } catch(ex) {
        // Util.log("PagedRemoteArray#fetchContent error " + error);
        console.log("PagedRemoteArray#fetchContent error: ", ex.message);
        reject("PagedRemoteArray#fetchContent error: " + ex.message);
      }
    });
  },

  async OLD_fetchContent() {
    this.set("loading",true);
    var res = await this.rawFindFromStore();
    this.incrementProperty("numRemoteCalls");
    var me = this;

    res.then(function(rows) {
      var metaObj = ChangeMeta.create({paramMapping: me.get('paramMapping'),
                                       meta: rows.meta,
                                       page: me.getPage(),
                                       perPage: me.getPerPage()});

      me.set("loading",false);
      return me.set("meta", metaObj.make());

    }, function(error) {
      Util.log("PagedRemoteArray#fetchContent error " + error);
      me.set("loading",false);
    });

    return res;
  },

  totalPages: Ember.computed.alias("meta.total_pages"),

  lastPage: null,

  pageChanged: Ember.observer("page", "perPage", async () => {
    var page = this.get('page');
    var lastPage = this.get('lastPage');
    if (lastPage != page) {
      this.set('lastPage', page);
      this.set("promise", await this.fetchContent());
    }
  }),

  lockToRange: function() {
    LockToRange.watch(this);
  },

  watchPage: Ember.observer('page','totalPages', function() {
    var page = this.get('page');
    var totalPages = this.get('totalPages');
    if (parseInt(totalPages) <= 0) {
      return;
    }

    this.trigger('pageChanged',page);

    if (page < 1 || page > totalPages) {
      this.trigger('invalidPage',{page: page, totalPages: totalPages, array: this});
    }
  }),

  async reload() {
    var promise = await this.fetchContent();
    this.set('promise', promise);
    return promise;
  },

  setOtherParam: function(k,v) {
    if (!this.get('otherParams')) {
      this.set('otherParams',{});
    }

    this.get('otherParams')[k] = v;
    this.incrementProperty('paramsForBackendCounter');
    Ember.run.once(this,"pageChanged");
  }
});
