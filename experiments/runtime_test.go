package main

// func TestRuntime(t *testing.T) {
// 	source := `export default function one() { return 1; }`
// 	compiledSource, err := rewriter.CompileTypescript([]byte(source))
// 	assert.Nil(t, err)

// 	runtime := NewApeiroRuntime()
// 	val, err := runtime.StepProcess(string(compiledSource))
// 	assert.Nil(t, err)
// 	assert.NotNil(t, val)

// 	res, _ := val.Object().MarshalJSON()
// 	fmt.Printf("val: %v\n", string(res))
// 	// assert.True(t, res.IsNumber(), "did not return a number")

// 	// assert.Equal(t, float64(111), res.Number())
// }

// func BenchmarkRuntime(b *testing.B) {
// 	source := `console.log('hi'); export default function one() { console.log('hello from one'); let a = 100 + 10 + 1; let b = a*10; return b; }`

// 	tempdir, err := os.MkdirTemp("", "benchmark*.db")
// 	if err != nil {
// 		panic(err)
// 	}
// 	defer os.RemoveAll(tempdir)

// 	runtime, err := NewApeiroRuntime("benchmark.db")
// 	assert.Nil(b, err)

// 	runtime.Start()

// 	mid, err := runtime.Mount([]byte(source))
// 	assert.Nil(b, err)

// 	fmt.Printf("mid: %s\n", mid)

// 	for i := 0; i < b.N; i++ {
// 		pid, watcher, err := runtime.SpawnAndWatch(mid)
// 		assert.Nil(b, err)

// 		fmt.Printf("waiting for %s\n", pid)
// 		<-watcher

// 		fmt.Printf("watcher triggered in benchmark for %s\n", pid)

// 		close(watcher)
// 	}

// 	// fmt.Printf("before stop\n")

// 	// runtime.Stop()
// }

// func TestRuntime1(t *testing.T) {
// 	source := `export default function one() { return 1; }`

// 	runtime, err := NewApeiroRuntime("test.db")
// 	assert.Nil(t, err)

// 	runtime.Start()

// 	mid, err := runtime.Mount(source)
// 	assert.Nil(t, err)

// 	fmt.Printf("mid: %s\n", mid)

// 	pid, err := runtime.Spawn(mid)
// 	assert.Nil(t, err)

// 	watcher, err := runtime.Watch(pid)
// 	assert.Nil(t, err)

// 	go func() {
// 		for {
// 			select {
// 			case <-watcher:
// 				fmt.Println("watcher triggered")
// 			case <-time.After(10 * time.Second):
// 				fmt.Println("watcher timeout for")
// 				return
// 			}
// 		}
// 	}()

// 	fmt.Printf("pid: %s\n", pid)
// 	fmt.Printf("is_pending: %v\n", runtime.HasPending())

// 	for runtime.HasPending() {
// 		fmt.Printf("is_pending: %v\n", runtime.HasPending())
// 		time.Sleep(1 * time.Second)
// 	}

// 	val, err := runtime.GetProcessValue(pid)
// 	assert.Nil(t, err)

// 	fmt.Printf("val: %v\n", val)

// 	fmt.Printf("done pending\n")
// 	runtime.Stop()
// 	// val, err := runtime.StepProcess(string(compiledSource))
// 	// assert.Nil(t, err)
// 	// assert.NotNil(t, val)

// 	// res, _ := val.Object().MarshalJSON()
// 	// fmt.Printf("val: %v\n", string(res))
// 	// assert.True(t, res.IsNumber(), "did not return a number")

// 	// assert.Equal(t, float64(111), res.Number())
// }
