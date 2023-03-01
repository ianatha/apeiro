let $frames = [];
function _$$new_frame(parentFrame, scope) {
	let result = {
		$pc: 0,
		$scope :scope,
	};
	$frames.push(result);
	return result;
}
function suspend() {
	$frames[$frames.length - 1].suspended = true;
	throw new Error(JSON.stringify($frames));
}