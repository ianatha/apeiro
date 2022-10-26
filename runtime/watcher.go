package runtime

import (
	"context"

	"github.com/rs/zerolog/log"
)

type WatchEvent struct {
	pid string
}

func SafeSend(ch chan *WatchEvent, value *WatchEvent) (closed bool) {
	defer func() {
		if recover() != nil {
			closed = false
		}
	}()

	ch <- value // panic if ch is closed
	return true // <=> closed = false; return
}

func removeMatchingFromArray(arr []chan *WatchEvent, value chan *WatchEvent) []chan *WatchEvent {
	var newArr []chan *WatchEvent
	for _, v := range arr {
		if v != value {
			newArr = append(newArr, v)
		}
	}
	return newArr
}

func (a *ApeiroRuntime) Watch(ctx context.Context, pid string) (chan *WatchEvent, error) {
	watchChan := make(chan *WatchEvent, 4)
	// TODO: lock
	prevWatchers, exists := a.watchers.Load(pid)
	if !exists {
		a.watchers.Store(pid, []chan *WatchEvent{watchChan})
	} else {
		prevWatchers = append(prevWatchers.([]chan *WatchEvent), watchChan)
		a.watchers.Store(pid, prevWatchers)
	}
	go func() {
		for {
			<-ctx.Done()
			log.Debug().Str(pid, "pid").Msg("/watch context done")
			if watchers, ok := a.watchers.Load(pid); ok {
				a.watchers.Store(pid, removeMatchingFromArray(watchers.([]chan *WatchEvent), watchChan))
			}
			close(watchChan)
			break
		}
	}()
	return watchChan, nil
}

func (a *ApeiroRuntime) triggerWatchers(pid string) {
	watchers, exist := a.watchers.Load(pid)
	if exist {
		var validatedWatchers []chan *WatchEvent
		log.Debug().Str("pid", pid).Int("len_watchers", len(watchers.([]chan *WatchEvent))).Msg("triggering")
		for _, watcher := range watchers.([]chan *WatchEvent) {
			if SafeSend(watcher, &WatchEvent{pid: pid}) {
				validatedWatchers = append(validatedWatchers, watcher)
			}
		}
		a.watchers.Store(pid, validatedWatchers)
	} else {
		log.Debug().Str("pid", pid).Msg("no watchers")
	}
}
