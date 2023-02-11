# Serializing Javascript/ECMAScript data

Although `JSON.stringify` does a decent job at serializing arbitrary ECMAScript
data, it's not a perferct serializtion/deserialization solution for arbitrary
data because `JSON.parse(JSON.stringify(data))` is not always equal to the
original `data`.

Its shortcomings are:

## Can't Serialize References

Consider `example_1`, which is defined by the following JS code:
```
const obj_1 = { name: "obj_1" };
const example_1 = { a: obj_1, b: obj_1 }
```

If I were to mutate `example_1.a.name`, `example_1.b.name` would also appear
to change, because `example_1.a` and `example_1.b` reference the same value:

```
example_1.a.name = "test_1";
assertEqual(example_1.a.name, example_1.b.name);
```

However, if I were to:
```
const reconstructed_example_1 = JSON.parse(JSON.stringify(example_1));
reconstructed_example_1.a.name = "test_2";
// !!! the following line fails
assertEqual(reconstructed_example_1.a.name, reconstructed_example_1.b.name);
```

### Serializing References

Proposed Solution: as we serialize, everytime we encounter a non-primitive value,
if it doesn't already have an id,

* we assign it a monotonically increasing id,
* we add it to the `references` dictionary

Non-primitive values are always serialized as `{ reference_id: $reference_id }`
outside of the `references` dictionary. Using this methodology, `example_1`
would be serialized to something like:
```
{
	data: { reference_id: 2 },
	references: {
		1: { name: "obj_1" },
		2: { a: { reference_id: 1 }, b: { reference_id: 2 } }
	}
}
```

### Can't serialize functions

A function is dependent on its soucre code, and the lexical scope in which it was defined.

We must find a way to bind a function into any lexical scope.





### Can't serialize classes

### Can't serialize other exotic data types
* ArrayBuffer
* Symbol