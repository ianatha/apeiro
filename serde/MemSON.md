# MemSON

MemSON is a JSON schema that respsents JS/ECMAScript objects as they were in memory.
For example, consider the following Javascript code:

```
var state = { identifier: 1 };
var root = { a: state, b: state };
```

In reality, `root.a` and `root.b` refer to the same object, which means that
setting `root.a.foo` and `root.b.foo` are equivalent operations. However, if
we were to naively serialize `root` using `JSON.stringify`, or
`serde_v8::from_v8` and deserialize it, `root.a` and `root.b` would no longer
be the same object.

MemSON solve this by using the following techniques:
* as values are serialized, if each value,
  * does't have a `reftag`, we assign one to them, and we serialize it as-is,
  * already has a `reftag`, we serialize a reference to the reftag.
* for Functions, TODO
* for Classes, TODO
* for ArrayBuffers, TODO

Functions in ECMAScript, are their declaration in conjunction with the scope in
which it was declared.


```
function newCounter(initValue) {
	var i = initValue;
	return {
		inc: function inc() {
			i = i + 1;
		},
		get: function get() {
			return i;
		},
	};
}
```

```
const $scope = new Scope();

$scope.newCounter = $fn(function newCounter($parentScope, initValue) {
	var $scope = new Scope($parentScope);
	$scope.i = { value: initValue };
	return {
		inc: $fn(function inc($parentScope) {
			var $scope = new Scope($parentScope);
			$scope.i.value = $scope.i.value + 1;
		}, $scope),
		get: $fn(function get($parentScope) {
			var $scope = new Scope($parentScope);
			return $scope.i.value;
		}, $scope),
	};
}, $scope);
```

When sending `newCounter`, we would also




--

# Javascript Syntax

## Statement Types
* Block Statement
* Empty Statement
* Labeled Statement
* Break Statement
* Return
* Continue
* If (contains block)
* Switch ?? 
* Throw (contains block)
* Try (contains block)
* While (contains block)
* DoWhile (containts block)
* For (contains block)
* ForIn (contains block)
* ForOf (contains block)
* Expressions
* Declarations

## Declarations
  * Class
  * Function
  * Variable
  * Typescript Interface
  * Typescript Type Alias
  * Typescript Enum
  * Typescript Module
  
## Expression Types
  * this
  * function -- contains block
  * unary expression
  * update expression (e.g. ++v, --v, v++, v--)
  * binary expression (e.g. x + y, x * y)
  * assignment expression (x = 1)
  * member expressoin (object.member)
  * super property
  * conditional (test ? if_true : if_false)
  * call
  * new (new Cat())
  * sequence
  * identifier
  * literals
    * array
    * object
    * string
    * boolean
    * null
    * numberic
    * regexp
    * JSX text
    * bigint
    * template
  * arrow function expression -- contains block
  * class expression -- contains block
  * yield expression
  * meta property expression
  * await expression
  * parenthesis expression
  * Extensions
    * JSX
      * JSX member
      * JSX namespaced
      * JSX empty
      * JSX element
      * JSX fragment
    * TS
      * TS Type ASsertion
      * TS Const Assertion
      * TS non Null
      * ts as
      * ts instantiation
      * ts satisfies
  * private name
  * optional chaining expression


## Exotic

* With
* Debugger
For ES5 (functions only -- no classes, no exotic stuff).
1. Convert all declarations to expression.
2. Store everything in a $scope.
3. Expose function scopes to a serialization function.
4. Serialize the prototype chain.

Every block of statements has a scope. Syntax elements that include a block statement are:
* functions
* if
* while
* for
* while
* do-while
* arrow expressions
* switch