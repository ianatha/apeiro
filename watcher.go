package apeiro

type WatchEvent struct {
	pid string
}

func SafeSend(ch chan *WatchEvent, value *WatchEvent) (closed bool) {
	defer func() {
		if recover() != nil {
			closed = true
		}
	}()

	ch <- value  // panic if ch is closed
	return false // <=> closed = false; return
}

func (a *ApeiroRuntime) Watch(pid string) (chan *WatchEvent, error) {
	watchChan := make(chan *WatchEvent, 4)
	// TODO: lock
	prevWatchers, exists := a.watchers.Load(pid)
	if !exists {
		a.watchers.Store(pid, []chan *WatchEvent{watchChan})
	} else {
		prevWatchers = append(prevWatchers.([]chan *WatchEvent), watchChan)
		a.watchers.Store(pid, prevWatchers)
	}
	return watchChan, nil
}

func (a *ApeiroRuntime) triggerWatchers(pid string) {
	watchers, exist := a.watchers.Load(pid)
	if exist {
		for _, watcher := range watchers.([]chan *WatchEvent) {
			SafeSend(watcher, &WatchEvent{pid: pid})
		}
	}
}
