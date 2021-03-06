/// <reference path="./BaseLayer.ts" />

namespace Net.Layers {

  const nj = NumJS;

  // a bit experimental layer for now. I think it works but I'm not 100%
  // the gradient check is a bit funky. I'll look into this a bit later.
  // Local Response Normalization in window, along depths of volumes
  export class LocalResponseNormalizationLayer extends BaseLayer implements ILayer {

    public layer_type: string = 'lrn';

    public in_act: Vol;
    public out_act: Vol;

    public k: number;
    public n: number;
    public alpha: number;
    public beta: number;

    private S_cache_: Vol;

    constructor(opt) {
      super(opt || {});

      // required
      this.k = opt.k;
      this.n = opt.n;
      this.alpha = opt.alpha;
      this.beta = opt.beta;

      // checks
      if (this.n % 2 === 0) {
        console.warn('WARNING n should be odd for LRN layer');
      }

      this.updateDimensions(opt.pred);
    }

    forward(V, is_training) {
      this.in_act = V;
      this.resetGradient();
      var A = V.cloneAndZero();
      this.S_cache_ = V.cloneAndZero();
      var n2 = Math.floor(this.n / 2);
      for (var x = 0; x < V.sx; x++) {
        for (var y = 0; y < V.sy; y++) {
          for (var i = 0; i < V.depth; i++) {

            var a_i = V.get(x, y, i);
            var f0 = this.k;
            var f1 = this.alpha / this.n;
            var sum = 0.0;

            // normalize in a window of size n
            for (var j = Math.max(0, i - n2); j <= Math.min(i + n2, V.depth - 1); j++) {
              var aa = V.get(x, y, j);
              sum += aa * aa;
            }

            // will be useful for backprop
            var scale_i = f0 + f1 * sum;
            this.S_cache_.set(x, y, i, scale_i);
            var b_i = a_i * Math.pow(scale_i, -this.beta);
            A.set(x, y, i, b_i);
          }
        }
      }

      this.out_act = A;
      return this.out_act; // dummy identity function for now
    }

    backward() {
      // evaluate gradient wrt data
      var V = this.in_act; // we need to set dw of this
      var A = this.out_act; // computed in forward pass 

      var n2 = Math.floor(this.n / 2);
      for (var x = 0; x < V.sx; x++) {
        for (var y = 0; y < V.sy; y++) {
          for (var i = 0; i < V.depth; i++) {

            var scale_i = this.S_cache_.get(x, y, i);
            var a_i = V.get(x, y, i);
            var be_i = A.get_grad(x, y, i);
            var f0 = Math.pow(scale_i, -this.beta) * be_i;
            var f1 = 2.0 * this.alpha * this.beta / this.n * a_i;
            var sum = 0.0;

            // normalize in a window of size n
            for (var j = Math.max(0, i - n2); j <= Math.min(i + n2, V.depth - 1); j++) {
              var b_j = A.get(x, y, j);
              var be_j = A.get_grad(x, y, j);
              var scale_j = this.S_cache_.get(x, y, j);

              sum += be_j * b_j / scale_j;
            }

            var ae_i = f0 - f1 * sum;
            V.add_grad(x, y, i, ae_i);
          }
        }
      }
    }

    getDescription() {
      return super.getDescription().concat([
        'n=' + this.n + ' ' + 'k=' + this.k,
      ]);
    }

    toJSON() {
      var json: any = super.toJSON();
      json.k = this.k;
      json.n = this.n;
      json.alpha = this.alpha; // normalize by size
      json.beta = this.beta;
      return json;
    }

    fromJSON(json: any) {
      super.fromJSON(json);
      this.k = json.k;
      this.n = json.n;
      this.alpha = json.alpha; // normalize by size
      this.beta = json.beta;
    }
  }
}
