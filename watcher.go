package apeiro

import "fmt"

type WatchEvent struct {
	pid string
}

func (a *ApeiroRuntime) Watch(pid string) (chan *WatchEvent, error) {
	watchChan := make(chan *WatchEvent, 1)
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
			select {
			case watcher <- &WatchEvent{pid}:
			default:
				fmt.Printf("watcher for %s is blocked\n", pid)
			}
		}
	}
}
