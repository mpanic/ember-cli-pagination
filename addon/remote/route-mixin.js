import Ember from 'ember';
import PagedRemoteArray from './paged-remote-array';
import Util from '../util';

export default Ember.Mixin.create({
  perPage: 10,
  startingPage: 1,

  // async model(params) {
  //   let routeName;
  //   try {
  //     routeName = this.get('routeName');
  //   } catch (ex) {
  //     console.log('error getting route name', ex.message);
  //   }
  //   return await this.findPaged(this._findModelName(routeName), params);
  // },

  _findModelName: function(routeName) {
    let modelName;
    try {
      modelName = Ember.String.singularize(
        Ember.String.camelize(routeName)
      );
    } catch (ex) {
      console.log('error getting ModelName', ex.message);
    }
    return modelName;
  },

  async findPaged(name, params, options, callback) {
    debugger;
    var opt = options || {};
    var mainOps = {
      page: params.page || this.get('startingPage'),
      perPage: params.perPage || this.get('perPage'),
      modelName: name,
      zeroBasedIndex: opt.zeroBasedIndex || false,
      store: this.get('store')
    };

    if (params.paramMapping) {
      mainOps.paramMapping = params.paramMapping;
    }

    var otherOps = Util.paramsOtherThan(params,["page","perPage","paramMapping","zeroBasedIndex"]);
    mainOps.otherParams = otherOps;

    mainOps.initCallback = callback;

    return PagedRemoteArray.create(mainOps);
  }
});
