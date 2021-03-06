export function awaitIterator (iterator) {
  var callNext = result => iterator.next(result),
      doThrow = error => iterator.throw(error),
      onSuccess = step(callNext),
      onError = step(doThrow);

  function step(getNext) {
      return (val) => {
          var next = getNext(val),
              value = next.value;

          return next.done ? value :
              (!value || typeof value.then !== 'function' ?
                  Array.isArray(value) ? Promise.all(value).then(onSuccess, onError) : onSuccess(value) :
                  value.then(onSuccess, onError));
      };
  }

  return step(callNext)();
}
