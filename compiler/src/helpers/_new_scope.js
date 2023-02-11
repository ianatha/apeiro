function _$$new_scope(parentScope) {
	const result = {};
	if (parentScope) {
		Object.setPrototypeOf(result, parentScope);
	}
	return result;
}