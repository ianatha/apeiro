// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

var p = /[^a-z0-9\-#$%&'*+.^_`|~]/i;
function a(e) {
    if (typeof e != "string" && (e = String(e)), p.test(e) || e.trim() === "") throw new TypeError("Invalid character in header field name");
    return e.toLowerCase();
}
function y(e) {
    return typeof e != "string" && (e = String(e)), e;
}
var o = Symbol("normalizedHeaders"), c = Symbol("rawHeaderNames"), u, d, l = class {
    constructor(e){
        this[u] = {}, this[d] = new Map, [
            "Headers",
            "HeadersPolyfill"
        ].includes(e?.constructor.name) || e instanceof l ? e.forEach((t, s)=>{
            this.append(s, t);
        }, this) : Array.isArray(e) ? e.forEach(([r, t])=>{
            this.append(r, Array.isArray(t) ? t.join(", ") : t);
        }) : e && Object.getOwnPropertyNames(e).forEach((r)=>{
            let t = e[r];
            this.append(r, Array.isArray(t) ? t.join(", ") : t);
        });
    }
    [(u = o, d = c, Symbol.iterator)]() {
        return this.entries();
    }
    *keys() {
        for (let e of Object.keys(this[o]))yield e;
    }
    *values() {
        for (let e of Object.values(this[o]))yield e;
    }
    *entries() {
        for (let e of Object.keys(this[o]))yield [
            e,
            this.get(e)
        ];
    }
    get(e) {
        return this[o][a(e)] || null;
    }
    set(e, r) {
        let t = a(e);
        this[o][t] = y(r), this[c].set(t, e);
    }
    append(e, r) {
        let t = a(e), s = this.has(t) ? `${this.get(t)}, ${r}` : r;
        this.set(e, s);
    }
    delete(e) {
        if (!this.has(e)) return;
        let r = a(e);
        delete this[o][r], this[c].delete(r);
    }
    all() {
        return this[o];
    }
    raw() {
        let e = {};
        for (let [r, t] of this.entries())e[this[c].get(r)] = t;
        return e;
    }
    has(e) {
        return this[o].hasOwnProperty(a(e));
    }
    forEach(e, r) {
        for(let t in this[o])this[o].hasOwnProperty(t) && e.call(r, this[o][t], t, this);
    }
};
function H(e) {
    let r = [];
    return e.forEach((t, s)=>{
        let n = t.includes(",") ? t.split(",").map((i)=>i.trim()) : t;
        r.push([
            s,
            n
        ]);
    }), r;
}
function E(e) {
    return H(e).map(([s, n])=>{
        let i = [].concat(n);
        return `${s}: ${i.join(", ")}`;
    }).join(`\r
`);
}
var m = [
    "user-agent"
];
function j(e) {
    let r = {};
    return e.forEach((t, s)=>{
        let n = !m.includes(s.toLowerCase()) && t.includes(",");
        r[s] = n ? t.split(",").map((i)=>i.trim()) : t;
    }), r;
}
function A(e) {
    return e.trim().split(/[\r\n]+/).reduce((t, s)=>{
        if (s.trim() === "") return t;
        let n = s.split(": "), i = n.shift(), h = n.join(": ");
        return t.append(i, h), t;
    }, new l);
}
function b(e) {
    let r = new l;
    return e.forEach(([t, s])=>{
        [].concat(s).forEach((i)=>{
            r.append(t, i);
        });
    }), r;
}
function f(e, r, t) {
    return Object.keys(e).reduce((s, n)=>r(s, n, e[n]), t);
}
function w(e) {
    return f(e, (r, t, s)=>([].concat(s).filter(Boolean).forEach((i)=>{
            r.append(t, i);
        }), r), new l);
}
function g(e) {
    return e.map(([r, t])=>[
            r,
            [].concat(t).join(", ")
        ]);
}
function O(e) {
    return f(e, (r, t, s)=>(r[t] = [].concat(s).join(", "), r), {});
}

export { l as Headers, g as flattenHeadersList, O as flattenHeadersObject, H as headersToList, j as headersToObject, E as headersToString, b as listToHeaders, w as objectToHeaders, f as reduceHeadersObject, A as stringToHeaders };
